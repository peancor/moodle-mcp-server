#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// Configuración de variables de entorno
const MOODLE_API_URL = process.env.MOODLE_API_URL;
const MOODLE_API_TOKEN = process.env.MOODLE_API_TOKEN;
const MOODLE_COURSE_ID = process.env.MOODLE_COURSE_ID;

// Verificar que las variables de entorno estén definidas
if (!MOODLE_API_URL) {
  throw new Error('MOODLE_API_URL environment variable is required');
}

if (!MOODLE_API_TOKEN) {
  throw new Error('MOODLE_API_TOKEN environment variable is required');
}

if (!MOODLE_COURSE_ID) {
  throw new Error('MOODLE_COURSE_ID environment variable is required');
}

// Interfaces para los tipos de datos
interface Student {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
}

interface Assignment {
  id: number;
  name: string;
  duedate: number;
  allowsubmissionsfromdate: number;
  grade: number;
  timemodified: number;
  cutoffdate: number;
}

interface Quiz {
  id: number;
  name: string;
  timeopen: number;
  timeclose: number;
  grade: number;
  timemodified: number;
}

interface Submission {
  id: number;
  userid: number;
  status: string;
  timemodified: number;
  gradingstatus: string;
  gradefordisplay?: string;
}

interface SubmissionContent {
  assignment: number;
  userid: number;
  status: string;
  submissiontext?: string;
  plugins?: Array<{
    type: string;
    content?: string;
    files?: Array<{
      filename: string;
      fileurl: string;
      filesize: number;
      filetype: string;
    }>;
  }>;
  timemodified: number;
}

interface QuizGradeResponse {
  hasgrade: boolean;
  grade?: string;  // Este campo solo está presente si hasgrade es true
}

class MoodleMcpServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'moodle-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: MOODLE_API_URL,
      params: {
        wstoken: MOODLE_API_TOKEN,
        moodlewsrestformat: 'json',
      },
    });

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_courses',
          description: 'Obtiene información de cursos en Moodle. Soporta paginación o búsqueda por ID.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'number',
                description: 'ID opcional del curso. Si se proporciona, solo devuelve ese curso.',
              },
              page: {
                type: 'number',
                description: 'Número de página para resultados (por defecto 0). Ignorado si se da courseId.',
              },
              limit: {
                type: 'number',
                description: 'Cantidad de cursos a devolver por página (por defecto 10). Ignorado si se da courseId.',
              }
            },
            required: [],
          },
        },
        {
          name: 'get_students',
          description: 'Obtiene la lista de estudiantes inscritos en el curso configurado',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'get_assignments',
          description: 'Obtiene la lista de tareas asignadas en el curso configurado',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'get_quizzes',
          description: 'Obtiene la lista de quizzes en el curso configurado',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'get_submissions',
          description: 'Obtiene las entregas de tareas en el curso configurado',
          inputSchema: {
            type: 'object',
            properties: {
              studentId: {
                type: 'number',
                description: 'ID opcional del estudiante. Si no se proporciona, se devolverán entregas de todos los estudiantes',
              },
              assignmentId: {
                type: 'number',
                description: 'ID opcional de la tarea. Si no se proporciona, se devolverán todas las entregas',
              },
            },
            required: [],
          },
        },
        {
          name: 'provide_feedback',
          description: 'Proporciona feedback sobre una tarea entregada por un estudiante',
          inputSchema: {
            type: 'object',
            properties: {
              studentId: {
                type: 'number',
                description: 'ID del estudiante',
              },
              assignmentId: {
                type: 'number',
                description: 'ID de la tarea',
              },
              grade: {
                type: 'number',
                description: 'Calificación numérica a asignar',
              },
              feedback: {
                type: 'string',
                description: 'Texto del feedback a proporcionar',
              },
            },
            required: ['studentId', 'assignmentId', 'feedback'],
          },
        },
        {
          name: 'get_submission_content',
          description: 'Obtiene el contenido detallado de una entrega específica, incluyendo texto y archivos adjuntos',
          inputSchema: {
            type: 'object',
            properties: {
              studentId: {
                type: 'number',
                description: 'ID del estudiante',
              },
              assignmentId: {
                type: 'number',
                description: 'ID de la tarea',
              },
            },
            required: ['studentId', 'assignmentId'],
          },
        },
        {
          name: 'get_quiz_grade',
          description: 'Obtiene la calificación de un estudiante en un quiz específico',
          inputSchema: {
            type: 'object',
            properties: {
              studentId: {
                type: 'number',
                description: 'ID del estudiante',
              },
              quizId: {
                type: 'number',
                description: 'ID del quiz',
              },
            },
            required: ['studentId', 'quizId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error(`[Tool] Executing tool: ${request.params.name}`);

      try {
        switch (request.params.name) {
          case 'get_courses':
            return await this.getCourses(request.params.arguments);
          case 'get_students':
            return await this.getStudents();
          case 'get_assignments':
            return await this.getAssignments();
          case 'get_quizzes':
            return await this.getQuizzes();
          case 'get_submissions':
            return await this.getSubmissions(request.params.arguments);
          case 'provide_feedback':
            return await this.provideFeedback(request.params.arguments);
          case 'get_submission_content':
            return await this.getSubmissionContent(request.params.arguments);
          case 'get_quiz_grade':
            return await this.getQuizGrade(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        console.error('[Error]', error);
        if (axios.isAxiosError(error)) {
          return {
            content: [
              {
                type: 'text',
                text: `Moodle API error: ${error.response?.data?.message || error.message
                  }`,
              },
            ],
            isError: true,
          };
        }
        throw error;
      }
    });
  }

  private async getCourses(args: any = {}) {
    const courseId = args?.courseId;
    const page = args?.page || 0;
    const limit = args?.limit || 10;

    if (courseId) {
      console.error(`[API] Requesting course ${courseId}`);
      const response = await this.axiosInstance.get('', {
        params: {
          wsfunction: 'core_course_get_courses',
          'options[ids][0]': courseId,
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data || [], null, 2) }],
      };
    } else {
      console.error(`[API] Requesting courses (page: ${page}, limit: ${limit})`);
      const response = await this.axiosInstance.get('', {
        params: {
          wsfunction: 'core_course_search_courses',
          criterianame: 'search',
          criteriavalue: ' ', // required
          page: page,
          perpage: limit,
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data || [], null, 2) }],
      };
    }
  }

  private async getStudents() {
    console.error('[API] Requesting enrolled users');

    const response = await this.axiosInstance.get('', {
      params: {
        wsfunction: 'core_enrol_get_enrolled_users',
        courseid: MOODLE_COURSE_ID,
      },
    });

    const students = response.data
      .filter((user: any) => user.roles.some((role: any) => role.shortname === 'student'))
      .map((student: any) => ({
        id: student.id,
        username: student.username,
        firstname: student.firstname,
        lastname: student.lastname,
        email: student.email,
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(students, null, 2),
        },
      ],
    };
  }

  private async getAssignments() {
    console.error('[API] Requesting assignments');

    const response = await this.axiosInstance.get('', {
      params: {
        wsfunction: 'mod_assign_get_assignments',
        courseids: [MOODLE_COURSE_ID],
      },
    });

    const assignments = response.data.courses[0]?.assignments || [];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(assignments, null, 2),
        },
      ],
    };
  }

  private async getQuizzes() {
    console.error('[API] Requesting quizzes');

    const response = await this.axiosInstance.get('', {
      params: {
        wsfunction: 'mod_quiz_get_quizzes_by_courses',
        courseids: [MOODLE_COURSE_ID],
      },
    });

    const quizzes = response.data.quizzes || [];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(quizzes, null, 2),
        },
      ],
    };
  }

  private async getSubmissions(args: any) {
    const studentId = args.studentId;
    const assignmentId = args.assignmentId;

    console.error(`[API] Requesting submissions${studentId ? ` for student ${studentId}` : ''}`);

    // Primero obtenemos todas las tareas
    const assignmentsResponse = await this.axiosInstance.get('', {
      params: {
        wsfunction: 'mod_assign_get_assignments',
        courseids: [MOODLE_COURSE_ID],
      },
    });

    const assignments = assignmentsResponse.data.courses[0]?.assignments || [];

    // Si se especificó un ID de tarea, filtramos solo esa tarea
    const targetAssignments = assignmentId
      ? assignments.filter((a: any) => a.id === assignmentId)
      : assignments;

    if (targetAssignments.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No se encontraron tareas para el criterio especificado.',
          },
        ],
      };
    }

    // Para cada tarea, obtenemos todas las entregas
    const submissionsPromises = targetAssignments.map(async (assignment: any) => {
      const submissionsResponse = await this.axiosInstance.get('', {
        params: {
          wsfunction: 'mod_assign_get_submissions',
          assignmentids: [assignment.id],
        },
      });

      const submissions = submissionsResponse.data.assignments[0]?.submissions || [];

      // Obtenemos las calificaciones para esta tarea
      const gradesResponse = await this.axiosInstance.get('', {
        params: {
          wsfunction: 'mod_assign_get_grades',
          assignmentids: [assignment.id],
        },
      });

      const grades = gradesResponse.data.assignments[0]?.grades || [];

      // Si se especificó un ID de estudiante, filtramos solo sus entregas
      const targetSubmissions = studentId
        ? submissions.filter((s: any) => s.userid === studentId)
        : submissions;

      // Procesamos cada entrega
      const processedSubmissions = targetSubmissions.map((submission: any) => {
        const studentGrade = grades.find((g: any) => g.userid === submission.userid);

        return {
          userid: submission.userid,
          status: submission.status,
          timemodified: new Date(submission.timemodified * 1000).toISOString(),
          grade: studentGrade ? studentGrade.grade : 'No calificado',
        };
      });

      return {
        assignment: assignment.name,
        assignmentId: assignment.id,
        submissions: processedSubmissions.length > 0 ? processedSubmissions : 'No hay entregas',
      };
    });

    const results = await Promise.all(submissionsPromises);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  private async provideFeedback(args: any) {
    if (!args.studentId || !args.assignmentId || !args.feedback) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Student ID, Assignment ID, and feedback are required'
      );
    }

    console.error(`[API] Providing feedback for student ${args.studentId} on assignment ${args.assignmentId}`);

    const response = await this.axiosInstance.get('', {
      params: {
        wsfunction: 'mod_assign_save_grade',
        assignmentid: args.assignmentId,
        userid: args.studentId,
        grade: args.grade || 0,
        attemptnumber: -1, // Último intento
        addattempt: 0,
        workflowstate: 'released',
        applytoall: 0,
        plugindata: {
          assignfeedbackcomments_editor: {
            text: args.feedback,
            format: 1, // Formato HTML
          },
        },
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: `Feedback proporcionado correctamente para el estudiante ${args.studentId} en la tarea ${args.assignmentId}.`,
        },
      ],
    };
  }

  private async getSubmissionContent(args: any) {
    if (!args.studentId || !args.assignmentId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Student ID and Assignment ID are required'
      );
    }

    console.error(`[API] Requesting submission content for student ${args.studentId} on assignment ${args.assignmentId}`);

    try {
      // Utilizamos la función mod_assign_get_submission_status para obtener el contenido detallado
      const response = await this.axiosInstance.get('', {
        params: {
          wsfunction: 'mod_assign_get_submission_status',
          assignid: args.assignmentId,
          userid: args.studentId,
        },
      });

      // Procesamos la respuesta para extraer el contenido relevante
      const submissionData = response.data.submission || {};
      const plugins = response.data.lastattempt?.submission?.plugins || [];

      // Extraemos el texto de la entrega y los archivos adjuntos
      let submissionText = '';
      const files = [];

      for (const plugin of plugins) {
        // Procesamos el plugin de texto en línea
        if (plugin.type === 'onlinetext') {
          const textField = plugin.editorfields?.find((field: any) => field.name === 'onlinetext');
          if (textField) {
            submissionText = textField.text || '';
          }
        }

        // Procesamos el plugin de archivos
        if (plugin.type === 'file') {
          const filesList = plugin.fileareas?.find((area: any) => area.area === 'submission_files');
          if (filesList && filesList.files) {
            for (const file of filesList.files) {
              files.push({
                filename: file.filename,
                fileurl: file.fileurl,
                filesize: file.filesize,
                filetype: file.mimetype,
              });
            }
          }
        }
      }

      // Construimos el objeto de respuesta
      const submissionContent = {
        assignment: args.assignmentId,
        userid: args.studentId,
        status: submissionData.status || 'unknown',
        submissiontext: submissionText,
        plugins: [
          {
            type: 'onlinetext',
            content: submissionText,
          },
          {
            type: 'file',
            files: files,
          },
        ],
        timemodified: submissionData.timemodified || 0,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(submissionContent, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('[Error]', error);
      if (axios.isAxiosError(error)) {
        return {
          content: [
            {
              type: 'text',
              text: `Error al obtener el contenido de la entrega: ${error.response?.data?.message || error.message
                }`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  private async getQuizGrade(args: any) {
    if (!args.studentId || !args.quizId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Student ID and Quiz ID are required'
      );
    }

    console.error(`[API] Requesting quiz grade for student ${args.studentId} on quiz ${args.quizId}`);

    try {
      const response = await this.axiosInstance.get('', {
        params: {
          wsfunction: 'mod_quiz_get_user_best_grade',
          quizid: args.quizId,
          userid: args.studentId,
        },
      });

      // Procesamos la respuesta
      const result = {
        quizId: args.quizId,
        studentId: args.studentId,
        hasGrade: response.data.hasgrade,
        grade: response.data.hasgrade ? response.data.grade : 'No calificado',
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('[Error]', error);
      if (axios.isAxiosError(error)) {
        return {
          content: [
            {
              type: 'text',
              text: `Error al obtener la calificación del quiz: ${error.response?.data?.message || error.message
                }`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Moodle MCP server running on stdio');
  }
}

const server = new MoodleMcpServer();
server.run().catch(console.error);
