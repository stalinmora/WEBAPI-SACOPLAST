import express from 'express';
import pool from '../config/db.js'; // ✅ Importación correcta
import { syncAllEmployees, syncOperators, syncSupervisors } from '../models/EmployeeSync.js';

const router = express.Router();

// Sincronizar todos los empleados
router.post('/sync-all', async (req, res) => {
  try {
    const result = await syncAllEmployees();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Sincronizar solo operadores
router.post('/sync-operators', async (req, res) => {
  try {
    const result = await syncOperators();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Sincronizar solo supervisores
router.post('/sync-supervisors', async (req, res) => {
  try {
    const result = await syncSupervisors();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener empleados
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM employees';
    let params = [];

    if (type) {
      query += ' WHERE employee_type = $1';
      params.push(type);
    }

    query += ' ORDER BY nombre_operador';

    // ✅ Aquí se usa pool correctamente
    const result = await pool.query(query, params);
    res.json({
      success: true,
      employees: result.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;