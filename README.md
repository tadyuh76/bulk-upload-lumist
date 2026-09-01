# Bulk Upload Excel Files to Supabase

A Next.js application for bulk uploading Excel files containing test questions to a Supabase database. This tool allows uploading 1-4 module files, reordering them, previewing data, and uploading to the database in the correct format.

## Features

- **Multiple File Upload**: Upload 1-4 Excel/CSV files for test modules
- **Drag-and-Drop Reordering**: Easily reorder modules by dragging files
- **Data Preview**: Review parsed questions before uploading
- **Figure Upload**: Upload many question figures and download a CSV of permanent Supabase URLs and Markdown snippets
- **Sequential Database Upload**: Automatically handles the upload sequence:
  1. Upload all questions → get question IDs
  2. Create test entry → get test ID
  3. Link questions to test via test_questions table
- **Progress Tracking**: Real-time progress updates during upload
- **Error Handling**: Comprehensive validation and error messages
- **Module Assignment**: Automatically assigns TESTSECTION1-4 based on file order

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Supabase** (Database)
- **XLSX** (Excel parsing)
- **DnD Kit** (Drag-and-drop functionality)
- **Tailwind CSS** (Styling)

## Setup Instructions

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Configure Supabase

Create a \`.env.local\` file in the root directory:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.qascademy.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

### 3. Database Schema

Ensure your Supabase database has the following tables:

- **questions**: Stores question data
- **tests**: Stores test metadata
- **test_sections**: Pre-defined sections (TESTSECTION1-4)
- **test_questions**: Junction table linking questions to tests

Refer to \`/data/database.sql\` for the complete schema.

### 4. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Excel File Format

Your Excel/CSV files should have the following columns:

| Column | Description |
|--------|-------------|
| Question ID | Unique reference ID (e.g., V1.1.1) |
| SAT_Tag | Tag/category (e.g., Vocab, Grammar) |
| Difficulty | EASY, MEDIUM, or INTENSE |
| Instruction | Instructions text |
| Question | Main question text |
| Answer A | First answer choice |
| Answer B | Second answer choice |
| Answer C | Third answer choice |
| Answer D | Fourth answer choice |
| Correct Answer | Letter of correct answer (A, B, C, or D) |
| Explanation | Explanation text |
| Organization ID | Optional owning organization for this question |
| In Question Bank | Optional `true` or `false`; overrides the upload default |
| Sub Skill | Optional secondary skill classification |
| Image Description | Optional accessible description of the question image |

## Usage

1. **Upload Figures (optional)**: Select the image figures, upload them, then download the links CSV. Give that CSV and the question spreadsheet to Claude; Claude can place a returned Markdown image snippet in the relevant Question or Instruction cell.
2. **Enter Test Details**: Provide a test title, optional description, organization ID, and question-bank default
3. **Upload Files**: Select 1-4 Excel/CSV files
4. **Reorder Modules**: Drag files to set their module order (1-4)
5. **Preview Data**: Click "Preview Data" to review parsed questions
6. **Upload**: Click "Upload to Database" to start the upload process

## Data Flow

```
Excel Files → Parse → Convert Format → Preview
                                          ↓
                                    Upload to DB:
                                    1. Questions
                                    2. Test
                                    3. Test Questions
```

## Notes

- Maximum 4 files can be uploaded at once (one per module)
- Files are automatically parsed and validated
- Correct answer is converted from letters (A-D) to indices (1-4)
- `organization_id`, `in_question_bank`, `sub_skill`, and `image_description` are accepted as optional spreadsheet columns (spaces and case differences are supported)
- Figure links are rendered from standard Markdown image syntax in the Question or Instruction column, such as `![Figure 1](https://supabase.lumist.ai/storage/v1/object/public/question-media/...)`
- A spreadsheet `in_question_bank` value overrides the selected upload default for that question
- Test sections (TESTSECTION1-4) must exist in your database
- All uploads are transactional - if any step fails, no data is saved

## Project Structure

```
├── app/
│   └── page.tsx                 # Main upload UI
├── lib/
│   ├── supabase.ts             # Supabase client & types
│   ├── excel-parser.ts         # Excel parsing logic
│   └── database.ts             # Database upload utilities
└── .env.local.example          # Environment variables template
```

## License

MIT
