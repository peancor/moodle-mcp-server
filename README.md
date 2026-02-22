# Moodle MCP Server

An MCP (Model Context Protocol) server that enables LLMs to interact with the Moodle platform to manage courses, students, assignments, and quizzes.

## Features

### Course Management Tools
- `get_courses` - Retrieves information about courses in Moodle
  - Supports pagination (`page`, `limit`) to safely fetch all available courses.
  - Optionally allows fetching a specific course by providing a `courseId`.

### Student Management Tools
- `list_students` - Retrieves the list of students enrolled in the course
  - Displays ID, name, email, and last access time for each student

### Assignment Management Tools
- `get_assignments` - Retrieves all available assignments in the course
  - Includes information such as ID, name, description, due date, and maximum grade
- `get_student_submissions` - Examines a student's submissions for a specific assignment
  - Requires the assignment ID and optionally the student ID
- `provide_assignment_feedback` - Provides grades and comments for a student's submission
  - Requires student ID, assignment ID, grade, and feedback comment

### Quiz Management Tools
- `get_quizzes` - Retrieves all available quizzes in the course
  - Includes information such as ID, name, description, opening/closing dates, and maximum grade
- `get_quiz_attempts` - Examines a student's attempts on a specific quiz
  - Requires the quiz ID and optionally the student ID
- `provide_quiz_feedback` - Provides comments for a quiz attempt
  - Requires the attempt ID and feedback comment

## Requirements

- Node.js (v14 or higher)
- Moodle API token with appropriate permissions
- Moodle course ID

## Installation

1. Clone this repository:
```bash
git clone https://github.com/your-username/moodle-mcp-server.git
cd moodle-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with the following configuration:
```
MOODLE_API_URL=https://your-moodle.com/webservice/rest/server.php
MOODLE_API_TOKEN=your_api_token
MOODLE_COURSE_ID=1  # Replace with your course ID
```

4. Build the server:
```bash
npm run build
```

## Usage with Claude

To use with Claude Desktop, add the server configuration:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`  
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "moodle-mcp-server": {
      "command": "/path/to/node",
      "args": [
        "/path/to/moodle-mcp-server/build/index.js"
      ],
      "env": {
        "MOODLE_API_URL": "https://your-moodle.com/webservice/rest/server.php",
        "MOODLE_API_TOKEN": "your_moodle_api_token",
        "MOODLE_COURSE_ID": "your_course_id"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

For Windows users, the paths would use backslashes:

```json
{
  "mcpServers": {
    "moodle-mcp-server": {
      "command": "C:\\path\\to\\node.exe",
      "args": [
        "C:\\path\\to\\moodle-mcp-server\\build\\index.js"
      ],
      "env": {
        "MOODLE_API_URL": "https://your-moodle.com/webservice/rest/server.php",
        "MOODLE_API_TOKEN": "your_moodle_api_token",
        "MOODLE_COURSE_ID": "your_course_id"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Once configured, Claude will be able to interact with your Moodle course to:
- View the list of students and their submissions
- Provide comments and grades for assignments
- Examine quiz attempts and offer feedback

## Development

For development with auto-rebuild:
```bash
npm run watch
```

### Debugging

MCP servers communicate through stdio, which can make debugging challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

## Obtaining a Moodle API Token

1. Log in to your Moodle site as an administrator
2. Go to Site Administration > Plugins > Web Services > Manage tokens
3. Create a new token with the necessary permissions to manage courses
4. Copy the generated token and add it to your `.env` file

## Security

- Never share your `.env` file or Moodle API token
- Ensure the MCP server only has access to the courses it needs to manage
- Use a token with the minimum necessary permissions

## License

[MIT](LICENSE)
