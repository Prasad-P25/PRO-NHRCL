import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { db } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export class CategoryController {
  getAllCategories = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Check if sections should be included (for audit execution)
      const includeSections = req.query.includeSections === 'true';

      const categoryResult = await db.query(
        `SELECT ac.*,
                (SELECT COUNT(*) FROM audit_items ai
                 JOIN audit_sections s ON ai.section_id = s.id
                 WHERE s.category_id = ac.id AND ai.is_active = true) as item_count
         FROM audit_categories ac
         WHERE ac.is_active = true
         ORDER BY ac.display_order`
      );

      if (!includeSections) {
        return res.json({
          success: true,
          data: categoryResult.rows.map((cat) => ({
            id: cat.id,
            code: cat.code,
            name: cat.name,
            fullTitle: cat.full_title,
            description: cat.description,
            type: cat.type,
            applicableStandards: cat.applicable_standards,
            displayOrder: cat.display_order,
            isActive: cat.is_active,
            itemCount: parseInt(cat.item_count),
          })),
        });
      }

      // Include sections with items for audit execution
      const categoriesWithSections = await Promise.all(
        categoryResult.rows.map(async (cat) => {
          const sectionsResult = await db.query(
            `SELECT s.*,
                    json_agg(
                      json_build_object(
                        'id', ai.id,
                        'srNo', ai.sr_no,
                        'auditPoint', ai.audit_point,
                        'standardReference', ai.standard_reference,
                        'evidenceRequired', ai.evidence_required,
                        'priority', ai.priority
                      ) ORDER BY ai.sr_no
                    ) FILTER (WHERE ai.id IS NOT NULL) as items
             FROM audit_sections s
             LEFT JOIN audit_items ai ON s.id = ai.section_id AND ai.is_active = true
             WHERE s.category_id = $1
             GROUP BY s.id
             ORDER BY s.display_order`,
            [cat.id]
          );

          return {
            id: cat.id,
            code: cat.code,
            name: cat.name,
            fullTitle: cat.full_title,
            description: cat.description,
            type: cat.type,
            applicableStandards: cat.applicable_standards,
            displayOrder: cat.display_order,
            isActive: cat.is_active,
            itemCount: parseInt(cat.item_count),
            sections: sectionsResult.rows.map((section) => ({
              id: section.id,
              code: section.code,
              name: section.name,
              displayOrder: section.display_order,
              items: section.items || [],
            })),
          };
        })
      );

      res.json({
        success: true,
        data: categoriesWithSections,
      });
    } catch (error) {
      next(error);
    }
  };

  getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const categoryResult = await db.query(
        'SELECT * FROM audit_categories WHERE id = $1',
        [id]
      );

      if (categoryResult.rows.length === 0) {
        throw new AppError('Category not found', 404);
      }

      const category = categoryResult.rows[0];

      // Get sections with items
      const sectionsResult = await db.query(
        `SELECT s.*,
                json_agg(
                  json_build_object(
                    'id', ai.id,
                    'srNo', ai.sr_no,
                    'auditPoint', ai.audit_point,
                    'standardReference', ai.standard_reference,
                    'evidenceRequired', ai.evidence_required,
                    'priority', ai.priority
                  ) ORDER BY ai.sr_no
                ) FILTER (WHERE ai.id IS NOT NULL) as items
         FROM audit_sections s
         LEFT JOIN audit_items ai ON s.id = ai.section_id AND ai.is_active = true
         WHERE s.category_id = $1
         GROUP BY s.id
         ORDER BY s.display_order`,
        [id]
      );

      res.json({
        success: true,
        data: {
          id: category.id,
          code: category.code,
          name: category.name,
          fullTitle: category.full_title,
          description: category.description,
          type: category.type,
          applicableStandards: category.applicable_standards,
          displayOrder: category.display_order,
          isActive: category.is_active,
          sections: sectionsResult.rows.map((section) => ({
            id: section.id,
            code: section.code,
            name: section.name,
            displayOrder: section.display_order,
            items: section.items || [],
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getCategoryItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT ai.*, s.code as section_code, s.name as section_name
         FROM audit_items ai
         JOIN audit_sections s ON ai.section_id = s.id
         WHERE s.category_id = $1 AND ai.is_active = true
         ORDER BY s.display_order, ai.sr_no`,
        [id]
      );

      res.json({
        success: true,
        data: result.rows.map((item) => ({
          id: item.id,
          sectionId: item.section_id,
          sectionCode: item.section_code,
          sectionName: item.section_name,
          srNo: item.sr_no,
          auditPoint: item.audit_point,
          standardReference: item.standard_reference,
          evidenceRequired: item.evidence_required,
          priority: item.priority,
          isActive: item.is_active,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  // Create category
  createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { code, name, fullTitle, description, type, applicableStandards, displayOrder } = req.body;

      const result = await db.query(
        `INSERT INTO audit_categories (code, name, full_title, description, type, applicable_standards, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [code, name, fullTitle || null, description || null, type || null, applicableStandards || null, displayOrder || 999]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Category created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Update category
  updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { code, name, fullTitle, description, type, applicableStandards, displayOrder, isActive } = req.body;

      await db.query(
        `UPDATE audit_categories SET
         code = COALESCE($1, code),
         name = COALESCE($2, name),
         full_title = COALESCE($3, full_title),
         description = COALESCE($4, description),
         type = COALESCE($5, type),
         applicable_standards = COALESCE($6, applicable_standards),
         display_order = COALESCE($7, display_order),
         is_active = COALESCE($8, is_active)
         WHERE id = $9`,
        [code, name, fullTitle, description, type, applicableStandards, displayOrder, isActive, id]
      );

      res.json({
        success: true,
        message: 'Category updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Create section
  createSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId, code, name, displayOrder } = req.body;

      const result = await db.query(
        `INSERT INTO audit_sections (category_id, code, name, display_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [categoryId, code, name, displayOrder || 999]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Section created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Update section
  updateSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { code, name, displayOrder } = req.body;

      await db.query(
        `UPDATE audit_sections SET
         code = COALESCE($1, code),
         name = COALESCE($2, name),
         display_order = COALESCE($3, display_order)
         WHERE id = $4`,
        [code, name, displayOrder, id]
      );

      res.json({
        success: true,
        message: 'Section updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete section
  deleteSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check if section has items
      const itemCheck = await db.query('SELECT COUNT(*) FROM audit_items WHERE section_id = $1', [id]);
      if (parseInt(itemCheck.rows[0].count) > 0) {
        throw new AppError('Cannot delete section with audit items', 400);
      }

      await db.query('DELETE FROM audit_sections WHERE id = $1', [id]);

      res.json({
        success: true,
        message: 'Section deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Create audit item
  createItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sectionId, srNo, auditPoint, standardReference, evidenceRequired, priority } = req.body;

      const result = await db.query(
        `INSERT INTO audit_items (section_id, sr_no, audit_point, standard_reference, evidence_required, priority)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [sectionId, srNo, auditPoint, standardReference || null, evidenceRequired || null, priority || 'P1']
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Audit item created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Update audit item
  updateItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { srNo, auditPoint, standardReference, evidenceRequired, priority, isActive } = req.body;

      await db.query(
        `UPDATE audit_items SET
         sr_no = COALESCE($1, sr_no),
         audit_point = COALESCE($2, audit_point),
         standard_reference = COALESCE($3, standard_reference),
         evidence_required = COALESCE($4, evidence_required),
         priority = COALESCE($5, priority),
         is_active = COALESCE($6, is_active)
         WHERE id = $7`,
        [srNo, auditPoint, standardReference, evidenceRequired, priority, isActive, id]
      );

      res.json({
        success: true,
        message: 'Audit item updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete audit item (soft delete)
  deleteItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await db.query('UPDATE audit_items SET is_active = false WHERE id = $1', [id]);

      res.json({
        success: true,
        message: 'Audit item deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
