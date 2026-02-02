import { Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { AuthRequest } from '../middleware/auth';

// Maturity Model Dimensions and Questions
const MATURITY_MODEL = {
  dimensions: [
    {
      name: 'Leadership & Commitment',
      questions: [
        { id: 'L1', question: 'Top management demonstrates visible commitment to safety through actions and decisions' },
        { id: 'L2', question: 'Safety performance is regularly reviewed at senior management level' },
        { id: 'L3', question: 'Adequate resources (budget, personnel, time) are allocated for safety' },
        { id: 'L4', question: 'Leaders actively participate in safety activities (walks, meetings, reviews)' },
        { id: 'L5', question: 'Safety is integrated into business decisions and project planning' },
      ],
    },
    {
      name: 'Policy & Strategic Objectives',
      questions: [
        { id: 'P1', question: 'Documented SHE policy signed by top management and communicated to all' },
        { id: 'P2', question: 'Clear safety objectives and targets are set and monitored' },
        { id: 'P3', question: 'Safety improvement plans are developed and implemented' },
        { id: 'P4', question: 'Policy is reviewed periodically and updated as needed' },
      ],
    },
    {
      name: 'Organization & Responsibilities',
      questions: [
        { id: 'O1', question: 'Safety roles and responsibilities are clearly defined at all levels' },
        { id: 'O2', question: 'Competent safety professionals are employed as per statutory requirements' },
        { id: 'O3', question: 'Safety committee is functional with regular meetings and action follow-up' },
        { id: 'O4', question: 'Contractor safety management system is in place' },
        { id: 'O5', question: 'Safety accountability is part of performance evaluation' },
      ],
    },
    {
      name: 'Risk Management',
      questions: [
        { id: 'R1', question: 'Comprehensive HIRA conducted for all activities' },
        { id: 'R2', question: 'Method statements and safe work procedures are documented' },
        { id: 'R3', question: 'Risk assessment is reviewed and updated regularly' },
        { id: 'R4', question: 'Workers participate in risk identification and control' },
        { id: 'R5', question: 'Management of Change (MOC) process is implemented' },
      ],
    },
    {
      name: 'Competence & Training',
      questions: [
        { id: 'T1', question: 'Training needs analysis is conducted and training matrix maintained' },
        { id: 'T2', question: 'Induction training covers all safety requirements' },
        { id: 'T3', question: 'Job-specific and specialized training is provided' },
        { id: 'T4', question: 'Training effectiveness is evaluated' },
        { id: 'T5', question: 'Toolbox talks are conducted daily' },
      ],
    },
    {
      name: 'Communication & Consultation',
      questions: [
        { id: 'C1', question: 'Safety information is effectively communicated to all workers' },
        { id: 'C2', question: 'Workers are consulted on safety matters affecting them' },
        { id: 'C3', question: 'Safety alerts and lessons learned are shared' },
        { id: 'C4', question: 'Mechanism exists for workers to report hazards and suggestions' },
      ],
    },
    {
      name: 'Operational Control',
      questions: [
        { id: 'OC1', question: 'Permit to Work system is effectively implemented' },
        { id: 'OC2', question: 'Equipment inspection and maintenance program in place' },
        { id: 'OC3', question: 'PPE management (selection, provision, use, maintenance)' },
        { id: 'OC4', question: 'Housekeeping standards are maintained' },
        { id: 'OC5', question: 'Subcontractor safety management is effective' },
      ],
    },
    {
      name: 'Emergency Preparedness',
      questions: [
        { id: 'E1', question: 'Emergency response plan documented and communicated' },
        { id: 'E2', question: 'Emergency equipment and resources are adequate' },
        { id: 'E3', question: 'Emergency drills are conducted and evaluated' },
        { id: 'E4', question: 'First aid and medical facilities are adequate' },
        { id: 'E5', question: 'Coordination with external emergency services' },
      ],
    },
    {
      name: 'Incident Management',
      questions: [
        { id: 'I1', question: 'All incidents (including near misses) are reported and recorded' },
        { id: 'I2', question: 'Incident investigation identifies root causes' },
        { id: 'I3', question: 'Corrective actions are implemented and tracked' },
        { id: 'I4', question: 'Lessons learned are shared across the organization' },
        { id: 'I5', question: 'Trend analysis is conducted to identify patterns' },
      ],
    },
    {
      name: 'Performance Measurement',
      questions: [
        { id: 'PM1', question: 'Leading and lagging safety indicators are tracked' },
        { id: 'PM2', question: 'Regular safety inspections and audits are conducted' },
        { id: 'PM3', question: 'Compliance with legal requirements is monitored' },
        { id: 'PM4', question: 'Safety performance is benchmarked and targets set' },
        { id: 'PM5', question: 'Data is analyzed to drive improvement' },
      ],
    },
  ],
  scoringCriteria: {
    1: 'Initial - Ad hoc, reactive, minimal awareness',
    2: 'Developing - Basic processes exist but inconsistent',
    3: 'Defined - Documented processes, consistent application',
    4: 'Managed - Proactive, measured, continuously improving',
    5: 'Optimized - Best practice, integrated into culture',
  },
};

export class MaturityController {
  // Get maturity model structure
  getMaturityModel = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: MATURITY_MODEL,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get all assessments with optional filters
  getAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, status } = req.query;

      let query = `
        SELECT ma.*, p.code as package_code, p.name as package_name,
               u.name as assessor_name
        FROM maturity_assessments ma
        JOIN packages p ON ma.package_id = p.id
        LEFT JOIN users u ON ma.assessor_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (packageId) {
        query += ` AND ma.package_id = $${paramIndex++}`;
        params.push(packageId);
      }

      if (status) {
        query += ` AND ma.status = $${paramIndex++}`;
        params.push(status);
      }

      query += ' ORDER BY ma.created_at DESC';

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows.map((row) => ({
          id: row.id,
          packageId: row.package_id,
          packageCode: row.package_code,
          packageName: row.package_name,
          assessmentDate: row.assessment_date,
          assessorId: row.assessor_id,
          assessorName: row.assessor_name,
          overallScore: row.overall_score ? parseFloat(row.overall_score) : null,
          status: row.status,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  // Get single assessment with responses
  getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const assessmentResult = await db.query(
        `SELECT ma.*, p.code as package_code, p.name as package_name,
                u.name as assessor_name
         FROM maturity_assessments ma
         JOIN packages p ON ma.package_id = p.id
         LEFT JOIN users u ON ma.assessor_id = u.id
         WHERE ma.id = $1`,
        [id]
      );

      if (assessmentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found',
        });
      }

      const assessment = assessmentResult.rows[0];

      // Get responses
      const responsesResult = await db.query(
        `SELECT * FROM maturity_responses WHERE assessment_id = $1 ORDER BY id`,
        [id]
      );

      res.json({
        success: true,
        data: {
          id: assessment.id,
          packageId: assessment.package_id,
          packageCode: assessment.package_code,
          packageName: assessment.package_name,
          assessmentDate: assessment.assessment_date,
          assessorId: assessment.assessor_id,
          assessorName: assessment.assessor_name,
          overallScore: assessment.overall_score ? parseFloat(assessment.overall_score) : null,
          status: assessment.status,
          createdAt: assessment.created_at,
          responses: responsesResult.rows.map((r) => ({
            id: r.id,
            dimension: r.dimension,
            question: r.question,
            score: r.score,
            evidence: r.evidence,
            gapIdentified: r.gap_identified,
            recommendations: r.recommendations,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Create new assessment
  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { packageId, assessmentDate } = req.body;
      const assessorId = req.user!.id;

      // Create assessment
      const result = await db.query(
        `INSERT INTO maturity_assessments (package_id, assessment_date, assessor_id, status)
         VALUES ($1, $2, $3, 'Draft')
         RETURNING id`,
        [packageId, assessmentDate || new Date(), assessorId]
      );

      const assessmentId = result.rows[0].id;

      // Pre-populate responses from maturity model
      for (const dimension of MATURITY_MODEL.dimensions) {
        for (const q of dimension.questions) {
          await db.query(
            `INSERT INTO maturity_responses (assessment_id, dimension, question)
             VALUES ($1, $2, $3)`,
            [assessmentId, dimension.name, q.question]
          );
        }
      }

      res.status(201).json({
        success: true,
        data: { id: assessmentId },
        message: 'Assessment created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Update assessment responses
  updateResponses = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { responses } = req.body;

      // Check if assessment exists
      const assessmentCheck = await db.query(
        'SELECT id, status FROM maturity_assessments WHERE id = $1',
        [id]
      );

      if (assessmentCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found',
        });
      }

      // Update responses
      for (const response of responses) {
        if (response.id) {
          await db.query(
            `UPDATE maturity_responses
             SET score = $1, evidence = $2, gap_identified = $3, recommendations = $4
             WHERE id = $5 AND assessment_id = $6`,
            [response.score, response.evidence, response.gapIdentified, response.recommendations, response.id, id]
          );
        }
      }

      // Calculate overall score
      const scoreResult = await db.query(
        `SELECT AVG(score) as avg_score FROM maturity_responses
         WHERE assessment_id = $1 AND score IS NOT NULL`,
        [id]
      );

      const overallScore = scoreResult.rows[0].avg_score
        ? parseFloat(scoreResult.rows[0].avg_score).toFixed(1)
        : null;

      // Update assessment overall score
      await db.query(
        'UPDATE maturity_assessments SET overall_score = $1 WHERE id = $2',
        [overallScore, id]
      );

      res.json({
        success: true,
        message: 'Responses updated successfully',
        data: { overallScore },
      });
    } catch (error) {
      next(error);
    }
  };

  // Submit assessment for review
  submit = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check completeness
      const incompleteResult = await db.query(
        `SELECT COUNT(*) as incomplete FROM maturity_responses
         WHERE assessment_id = $1 AND score IS NULL`,
        [id]
      );

      if (parseInt(incompleteResult.rows[0].incomplete) > 0) {
        return res.status(400).json({
          success: false,
          message: 'All questions must be scored before submission',
        });
      }

      await db.query(
        `UPDATE maturity_assessments SET status = 'Completed' WHERE id = $1`,
        [id]
      );

      res.json({
        success: true,
        message: 'Assessment submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Get dimension summary for an assessment
  getDimensionSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT dimension, AVG(score) as avg_score, COUNT(*) as question_count,
                COUNT(CASE WHEN score IS NOT NULL THEN 1 END) as answered_count
         FROM maturity_responses
         WHERE assessment_id = $1
         GROUP BY dimension
         ORDER BY MIN(id)`,
        [id]
      );

      res.json({
        success: true,
        data: result.rows.map((row) => ({
          dimension: row.dimension,
          avgScore: row.avg_score ? parseFloat(row.avg_score).toFixed(1) : null,
          questionCount: parseInt(row.question_count),
          answeredCount: parseInt(row.answered_count),
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete assessment
  delete = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check if assessment exists and is in Draft status
      const check = await db.query(
        'SELECT status FROM maturity_assessments WHERE id = $1',
        [id]
      );

      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found',
        });
      }

      if (check.rows[0].status !== 'Draft') {
        return res.status(400).json({
          success: false,
          message: 'Only draft assessments can be deleted',
        });
      }

      await db.query('DELETE FROM maturity_assessments WHERE id = $1', [id]);

      res.json({
        success: true,
        message: 'Assessment deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
