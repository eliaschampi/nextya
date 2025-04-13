import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { omrProcessor as processOmrImage } from '$lib/omrProcessor';
import type { AnswerValue } from '$lib/omrProcessor';
import type { EvalQuestion } from '../../../../app';

// Función auxiliar para obtener las preguntas de evaluación
async function fetchQuestions(
  evalCode: string,
  providedQuestions: unknown,
  supabase: any
): Promise<EvalQuestion[]> {
  if (providedQuestions && Array.isArray(providedQuestions) && providedQuestions.length > 0) {
    return providedQuestions as EvalQuestion[];
  }

  const { data, error } = await supabase
    .from('eval_questions')
    .select('*')
    .eq('eval_code', evalCode)
    .order('order_in_eval');

  if (error || !data) {
    console.error('Error fetching questions:', error);
    throw new Error('Failed to fetch evaluation questions');
  }

  return data as EvalQuestion[];
}

// Función auxiliar para verificar duplicados
async function checkDuplicate(
  supabase: any,
  rollCode: string,
  levelCode: string,
  groupName: string
): Promise<any> {
  const { data, error } = await supabase
    .from('registers')
    .select('code, students(name, last_name)')
    .eq('roll_code', rollCode)
    .eq('level_code', levelCode)
    .eq('group_name', groupName);

  if (error) {
    console.error('Error checking for duplicates:', error);
    throw new Error('Error al verificar duplicados');
  }

  return data;
}

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const { imageData, evalData, rollCode = null, questions = null } = await request.json();

    if (!imageData || !evalData.code) {
      return json({ status: 'error', message: 'Argumentos faltantes' }, { status: 400 });
    }

    const evalCode = evalData.code;
    const questionsData = await fetchQuestions(evalCode, questions, locals.supabase);

    // Convertir la imagen de base64 a buffer
    const numQuestions = questionsData.length;
    const buffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    // Procesar la imagen OMR
    const omrResult = await processOmrImage(buffer, numQuestions, true);
    if (omrResult.status === 'error') {
      return json(omrResult);
    }

    // Usar el rollCode proporcionado o el detectado por el procesamiento
    const studentRollCode = rollCode || omrResult.studentCode;

    // Validar que el rollCode tenga 4 dígitos
    if (!/^\d{4}$/.test(studentRollCode)) {
      return json(
        {
          status: 'error',
          errorType: 'invalid_roll_code',
          message: `Código inválido: ${studentRollCode}. Debe ser 4 dígitos numéricos.`,
          detectedCode: omrResult.studentCode,
          omrResult
        },
        { status: 400 }
      );
    }

    // Verificar si ya existe un registro con el mismo código en el mismo nivel/grupo
    const duplicateCheck = await checkDuplicate(
      locals.supabase,
      studentRollCode,
      evalData.level_code,
      evalData.group_name
    );

    // Procesar las respuestas y evaluar resultados
    let correctCount = 0;
    let incorrectCount = 0;
    let blankCount = 0;
    let totalScore = 0;

    for (const question of questionsData) {
      const questionIndex = question.order_in_eval - 1;
      const studentAnswer = omrResult.answers[questionIndex];

      if (!studentAnswer || studentAnswer === null) {
        blankCount++;
      } else if (studentAnswer === 'error_multiple') {
        incorrectCount++;
      } else if (studentAnswer.toUpperCase() === question.correct_key) {
        correctCount++;
        totalScore += Number(question.score_percent);
      } else {
        incorrectCount++;
      }
    }

    const studentInfo =
      duplicateCheck && duplicateCheck.length > 0
        ? {
            name: duplicateCheck[0].students.name,
            lastName: duplicateCheck[0].students.last_name,
            rollCode: studentRollCode,
            registerCode: duplicateCheck[0].code
          }
        : null;

    return json({
      status: 'success',
      detectedCode: omrResult.studentCode,
      studentCode: studentRollCode,
      student: studentInfo,
      duplicateFound: duplicateCheck && duplicateCheck.length > 0,
      validationStatus: {
        isValid: studentInfo !== null,
        message:
          studentInfo === null
            ? `No se encontró estudiante con código ${studentRollCode} en este nivel/grupo`
            : 'Estudiante encontrado'
      },
      results: {
        correctCount,
        incorrectCount,
        blankCount,
        totalScore
      },
      answers: Object.entries(omrResult.answers).reduce(
        (acc, [key, value]) => {
          acc[Number(key)] = value;
          return acc;
        },
        {} as Record<number, AnswerValue>
      ),
      questions: questionsData
    });
  } catch (error) {
    console.error('OMR API error:', error);
    return json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
};