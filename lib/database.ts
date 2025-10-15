import {
  supabase,
  type Question,
  type Test,
  type TestQuestion,
} from "./supabase";

export interface UploadProgress {
  stage: "questions" | "test" | "test_questions" | "complete";
  current: number;
  total: number;
  message: string;
}

export async function uploadQuestions(
  questions: Question[],
  onProgress?: (progress: UploadProgress) => void
): Promise<string[]> {
  const questionIds: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    onProgress?.({
      stage: "questions",
      current: i + 1,
      total: questions.length,
      message: `Uploading question ${i + 1} of ${questions.length}`,
    });

    const { data, error } = await supabase
      .from("questions")
      .insert(questions[i])
      .select("question_id")
      .single();

    if (error) {
      console.error("Error uploading question:", error);
      throw new Error(`Failed to upload question ${i + 1}: ${error.message}`);
    }

    if (data?.question_id) {
      questionIds.push(data.question_id);
    }
  }

  return questionIds;
}

export async function createTest(
  test: Test,
  onProgress?: (progress: UploadProgress) => void
): Promise<string> {
  onProgress?.({
    stage: "test",
    current: 1,
    total: 1,
    message: "Creating test entry...",
  });

  const { data, error } = await supabase
    .from("tests")
    .insert(test)
    .select("test_id")
    .single();

  if (error) {
    console.error("Error creating test:", error);
    throw new Error(`Failed to create test: ${error.message}`);
  }

  if (!data?.test_id) {
    throw new Error("Test created but no test_id returned");
  }

  return data.test_id;
}

export async function updateTestSections(
  moduleNumbers: number[]
): Promise<void> {
  // Update test sections 3 and 4 to enable desmos and mark as math sections
  const mathModules = moduleNumbers.filter((num) => num === 3 || num === 4);

  for (const moduleNum of mathModules) {
    const testSectionId = `TESTSECTION${moduleNum}`;

    const { error } = await supabase
      .from("test_sections")
      .update({
        is_desmos_allowed: true,
        is_math_section: true,
      })
      .eq("test_section_id", testSectionId);

    if (error) {
      console.error(`Error updating test section ${testSectionId}:`, error);
      // Don't throw error, just log it since this is a supplementary update
    }
  }
}

export async function uploadTestQuestions(
  testQuestions: TestQuestion[],
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  for (let i = 0; i < testQuestions.length; i++) {
    onProgress?.({
      stage: "test_questions",
      current: i + 1,
      total: testQuestions.length,
      message: `Linking question ${i + 1} of ${testQuestions.length}`,
    });

    const { error } = await supabase
      .from("test_questions")
      .insert(testQuestions[i]);

    if (error) {
      console.error("Error uploading test question:", error);
      throw new Error(`Failed to link question ${i + 1}: ${error.message}`);
    }
  }
}

export interface ModuleData {
  moduleNumber: number;
  questions: Question[];
}

export async function uploadBulkData(
  modules: ModuleData[],
  testTitle: string,
  testDescription: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ test_id: string; total_questions: number }> {
  try {
    // Step 1: Upload all questions and collect their IDs
    const allQuestions: Question[] = [];
    const moduleQuestionIds: { moduleNumber: number; questionIds: string[] }[] =
      [];

    for (const moduleData of modules) {
      allQuestions.push(...moduleData.questions);
    }

    const questionIds = await uploadQuestions(allQuestions, onProgress);

    // Map question IDs back to their modules
    let currentIndex = 0;
    for (const moduleData of modules) {
      const count = moduleData.questions.length;
      moduleQuestionIds.push({
        moduleNumber: moduleData.moduleNumber,
        questionIds: questionIds.slice(currentIndex, currentIndex + count),
      });
      currentIndex += count;
    }

    // Step 2: Create test
    const test: Test = {
      title: testTitle,
      description: testDescription,
      is_full_test: modules.length === 4,
    };

    const testId = await createTest(test, onProgress);

    // Step 2.5: Update test sections for math modules (3 and 4)
    const moduleNumbers = modules.map((m) => m.moduleNumber);
    await updateTestSections(moduleNumbers);

    // Step 3: Create test_questions
    const testQuestions: TestQuestion[] = [];
    let orderCounter = 1;

    for (const moduleData of moduleQuestionIds) {
      const testSectionId = `TESTSECTION${moduleData.moduleNumber}`;

      for (const questionId of moduleData.questionIds) {
        testQuestions.push({
          question_id: questionId,
          test_section_id: testSectionId,
          test_id: testId,
          order_in_test: orderCounter++,
        });
      }
    }

    await uploadTestQuestions(testQuestions, onProgress);

    onProgress?.({
      stage: "complete",
      current: testQuestions.length,
      total: testQuestions.length,
      message: "Upload complete!",
    });

    return {
      test_id: testId,
      total_questions: allQuestions.length,
    };
  } catch (error) {
    console.error("Bulk upload error:", error);
    throw error;
  }
}
