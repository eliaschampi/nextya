import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	// Student dashboard functions
	await sql`
		CREATE OR REPLACE FUNCTION get_student_score_evolution(p_student_code TEXT)
		RETURNS TABLE (
			eval_code TEXT,
			eval_name VARCHAR,
			eval_date DATE,
			score NUMERIC
		) LANGUAGE plpgsql SECURITY DEFINER AS $$
		BEGIN
			RETURN QUERY
			WITH student_results AS (
				SELECT
					er.eval_code,
					e.name AS eval_name,
					e.eval_date,
					er.score
				FROM
					eval_results er
					JOIN registers r ON er.register_code = r.code
					JOIN evals e ON er.eval_code = e.code
				WHERE
					r.student_code = p_student_code::UUID
					AND er.section_code IS NULL
				ORDER BY
					e.eval_date ASC
			)
			SELECT
				sr.eval_code::TEXT,
				sr.eval_name,
				sr.eval_date,
				sr.score
			FROM
				student_results sr;
		END;
		$$;
	`.execute(db);

	await sql`
		CREATE OR REPLACE FUNCTION get_student_course_scores(p_student_code TEXT)
		RETURNS TABLE (
			course_code TEXT,
			course_name VARCHAR,
			average_score NUMERIC
		) LANGUAGE plpgsql SECURITY DEFINER AS $$
		BEGIN
			RETURN QUERY
			WITH course_results AS (
				SELECT
					es.course_code,
					c.name AS course_name,
					er.score
				FROM
					eval_results er
					JOIN eval_sections es ON er.section_code = es.code
					JOIN courses c ON es.course_code = c.code
					JOIN registers r ON er.register_code = r.code
				WHERE
					r.student_code = p_student_code::UUID
					AND er.section_code IS NOT NULL
			),
			course_averages AS (
				SELECT
					cr.course_code,
					cr.course_name,
					AVG(cr.score) AS average_score
				FROM
					course_results cr
				GROUP BY
					cr.course_code, cr.course_name
			)
			SELECT
				ca.course_code::TEXT,
				ca.course_name,
				ROUND(ca.average_score, 2) AS average_score
			FROM
				course_averages ca
			ORDER BY
				ca.course_name;
		END;
		$$;
	`.execute(db);

	await sql`
		CREATE OR REPLACE FUNCTION get_student_course_evolution(p_student_code TEXT)
		RETURNS TABLE (
			eval_code TEXT,
			eval_name VARCHAR,
			eval_date DATE,
			course_code TEXT,
			course_name VARCHAR,
			score NUMERIC
		) LANGUAGE plpgsql SECURITY DEFINER AS $$
		BEGIN
			RETURN QUERY
			WITH course_evolution AS (
				SELECT
					e.code AS eval_code,
					e.name AS eval_name,
					e.eval_date,
					es.course_code,
					c.name AS course_name,
					er.score
				FROM
					eval_results er
					JOIN eval_sections es ON er.section_code = es.code
					JOIN courses c ON es.course_code = c.code
					JOIN evals e ON er.eval_code = e.code
					JOIN registers r ON er.register_code = r.code
				WHERE
					r.student_code = p_student_code::UUID
					AND er.section_code IS NOT NULL
				ORDER BY
					e.eval_date ASC, c.name ASC
			)
			SELECT
				ce.eval_code::TEXT,
				ce.eval_name,
				ce.eval_date,
				ce.course_code::TEXT,
				ce.course_name,
				ce.score
			FROM
				course_evolution ce;
		END;
		$$;
	`.execute(db);

	// Level dashboard functions
	await sql`
		CREATE OR REPLACE FUNCTION get_level_dashboard_data(p_level_code TEXT)
		RETURNS TABLE (
			data_type TEXT,
			json_data JSONB
		) LANGUAGE plpgsql SECURITY DEFINER AS $$
		DECLARE
			v_correct_vs_incorrect JSONB;
			v_scores_by_group JSONB;
		BEGIN
			-- Get correct vs incorrect data
			SELECT
				jsonb_build_object(
					'correct', COALESCE(SUM(er.correct_count), 0),
					'incorrect', COALESCE(SUM(er.incorrect_count), 0),
					'blank', COALESCE(SUM(er.blank_count), 0)
				) INTO v_correct_vs_incorrect
			FROM
				eval_results er
				JOIN registers r ON er.register_code = r.code
			WHERE
				r.level_code = p_level_code::UUID
				AND er.section_code IS NULL;

			-- Get scores by group data
			WITH group_scores AS (
				SELECT
					r.group_name,
					ROUND(AVG(er.score)::numeric, 2) AS average_score
				FROM
					eval_results er
					JOIN registers r ON er.register_code = r.code
				WHERE
					r.level_code = p_level_code::UUID
					AND er.section_code IS NULL
				GROUP BY
					r.group_name
				ORDER BY
					r.group_name
			)
			SELECT
				jsonb_agg(
					jsonb_build_object(
						'group', gs.group_name,
						'averageScore', gs.average_score
					)
					ORDER BY gs.group_name
				) INTO v_scores_by_group
			FROM
				group_scores gs;

			-- Return the data
			RETURN QUERY
			SELECT 'correctVsIncorrect', v_correct_vs_incorrect
			UNION ALL
			SELECT 'scoresByGroup', COALESCE(v_scores_by_group, '[]'::jsonb);
		END;
		$$;
	`.execute(db);

	await sql`
		CREATE OR REPLACE FUNCTION get_group_dashboard_data(p_level_code TEXT, p_group_name TEXT)
		RETURNS TABLE (
			data_type TEXT,
			json_data JSONB
		) LANGUAGE plpgsql SECURITY DEFINER AS $$
		DECLARE
			v_scores_by_eval JSONB;
			v_student_performance JSONB;
		BEGIN
			-- Get scores by eval data
			WITH eval_scores AS (
				SELECT
					e.name,
					e.eval_date,
					ROUND(AVG(er.score)::numeric, 2) AS average_score
				FROM
					eval_results er
					JOIN registers r ON er.register_code = r.code
					JOIN evals e ON er.eval_code = e.code
				WHERE
					r.level_code = p_level_code::UUID
					AND r.group_name = p_group_name
					AND er.section_code IS NULL
				GROUP BY
					e.code, e.name, e.eval_date
			)
			SELECT
				jsonb_agg(
					jsonb_build_object(
						'name', es.name,
						'averageScore', es.average_score
					)
					ORDER BY es.eval_date ASC
				) INTO v_scores_by_eval
			FROM
				eval_scores es;

			-- Get student performance data (top 10)
			WITH student_scores AS (
				SELECT
					s.name || ' ' || s.last_name AS student_name,
					ROUND(AVG(er.score)::numeric, 2) AS avg_score
				FROM
					eval_results er
					JOIN registers r ON er.register_code = r.code
					JOIN students s ON r.student_code = s.code
				WHERE
					r.level_code = p_level_code::UUID
					AND r.group_name = p_group_name
					AND er.section_code IS NULL
				GROUP BY
					s.code, s.name, s.last_name
				ORDER BY
					avg_score DESC
				LIMIT 10
			)
			SELECT
				jsonb_agg(
					jsonb_build_object(
						'name', ss.student_name,
						'averageScore', ss.avg_score
					)
					ORDER BY ss.avg_score DESC
				) INTO v_student_performance
			FROM
				student_scores ss;

			-- Return the data
			RETURN QUERY
			SELECT 'scoresByEval', COALESCE(v_scores_by_eval, '[]'::jsonb)
			UNION ALL
			SELECT 'studentPerformance', COALESCE(v_student_performance, '[]'::jsonb);
		END;
		$$;
	`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP FUNCTION IF EXISTS get_student_score_evolution(TEXT)`.execute(db);
	await sql`DROP FUNCTION IF EXISTS get_student_course_scores(TEXT)`.execute(db);
	await sql`DROP FUNCTION IF EXISTS get_student_course_evolution(TEXT)`.execute(db);
	await sql`DROP FUNCTION IF EXISTS get_level_dashboard_data(TEXT)`.execute(db);
	await sql`DROP FUNCTION IF EXISTS get_group_dashboard_data(TEXT, TEXT)`.execute(db);
}
