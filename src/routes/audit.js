import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// OBTENER REGISTROS DE AUDITORÍA
router.get('/', async (req, res) => {
  const { startDate, endDate, tableName } = req.query;

  try {
    let query = `
      SELECT id, table_name, operation, record_id, old_values, new_values, changed_by, changed_at
      FROM audit_log
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      query += ` AND changed_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND changed_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    if (tableName) {
      query += ` AND table_name = $${params.length + 1}`;
      params.push(tableName);
    }

    query += ` ORDER BY changed_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      logs: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;