import { createClient } from "@supabase/supabase-js";
import type {
  ExamMode,
  ModuleData,
  Test,
  TestQuestion,
  UploadOptions,
} from "./upload-types";

function getDatabaseClient(examMode: ExamMode) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Bulk upload service is not configured");
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return examMode === "sat" ? client : client.schema(examMode);
}

async function removePartialUpload(
  examMode: ExamMode,
  testId: string | undefined,
  questionIds: string[]
) {
  const db = getDatabaseClient(examMode);

  if (testId) {
    await db.from("test_questions").delete().eq("test_id", testId);
    await db.from("tests").delete().eq("test_id", testId);
  }

  if (questionIds.length > 0) {
    await db.from("questions").delete().in("question_id", questionIds);
  }
}

export async function uploadBulkData(
  modules: ModuleData[],
  testTitle: string,
  testDescription: string,
  examMode: ExamMode,
  options: UploadOptions
): Promise<{ test_id: string; total_questions: number }> {
  const allQuestions = modules.flatMap((module) =>
    module.questions.map((question) => ({
      ...question,
      organization_id: question.organization_id ?? options.organizationId,
      in_question_bank: question.in_question_bank ?? options.inQuestionBank,
      is_premium: question.is_premium ?? options.isPremium,
    }))
  );

  const organizationIds = [
    ...new Set(
      allQuestions
        .map((question) => question.organization_id)
        .filter((organizationId): organizationId is string => Boolean(organizationId))
    ),
  ];

  if (organizationIds.length > 1) {
    throw new Error(
      "All questions in one test must use the same organization ID."
    );
  }

  const db = getDatabaseClient(examMode);
  const questionIds: string[] = [];
  let testId: string | undefined;

  try {
    for (const question of allQuestions) {
      const { data, error } = await db
        .from("questions")
        .insert(question)
        .select("question_id")
        .single();

      if (error || !data?.question_id) {
        throw new Error("Unable to save questions");
      }

      questionIds.push(data.question_id);
    }

    const test: Test = {
      title: testTitle,
      description: testDescription,
      is_full_test: modules.length === 4,
      organization_id: organizationIds[0],
    };

    const { data: testData, error: testError } = await db
      .from("tests")
      .insert(test)
      .select("test_id")
      .single();

    if (testError || !testData?.test_id) {
      throw new Error("Unable to create the test");
    }

    const createdTestId = testData.test_id;
    testId = createdTestId;

    const testQuestions: TestQuestion[] = [];
    let questionIndex = 0;
    let orderInTest = 1;

    for (const moduleData of modules) {
      for (let index = 0; index < moduleData.questions.length; index += 1) {
        const questionId = questionIds[questionIndex++];

        if (!questionId) {
          throw new Error("Unable to add questions to the test");
        }

        testQuestions.push({
          question_id: questionId,
          test_section_id: `TESTSECTION${moduleData.moduleNumber}`,
          test_id: createdTestId,
          order_in_test: orderInTest++,
        });
      }
    }

    const { error: testQuestionsError } = await db
      .from("test_questions")
      .insert(testQuestions);

    if (testQuestionsError) {
      throw new Error("Unable to add questions to the test");
    }

    return { test_id: createdTestId, total_questions: allQuestions.length };
  } catch (error) {
    await removePartialUpload(examMode, testId, questionIds);
    throw error;
  }
}
