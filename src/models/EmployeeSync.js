import { connectToSqlServer } from './SqlServerConnection.js';
import pool from '../config/db.js';

export const syncOperators = async () => {
  try {
    const sqlPool = await connectToSqlServer();
    
    // Consulta para operadores
    const operatorsQuery = `
      SELECT 
        CARGO.NOMBRE AS 'CARGO',
        EMPLEADO.EMPLEADOID AS 'EMPLEADO_ID',
        PERSONA.IDENTIFICACION AS 'EMPLEADO_IDENTIFICACION',
        PERSONA.APELLIDOS + ' ' + PERSONA.NOMBRES AS 'NOMBRE_OPERADOR',
        EMPLEADO.FECHAINGRESO AS 'EMPLEADO_FECHA_INGRESO'
      FROM dbo.Personas AS PERSONA
      INNER JOIN dbo.Empleados AS EMPLEADO ON (PERSONA.PERSONAID = EMPLEADO.PERSONAID)
      INNER JOIN dbo.CARGOS AS CARGO ON (EMPLEADO.CARGOID = CARGO.CARGOID)
      WHERE CARGO.NOMBRE LIKE 'OP%' AND (FECHASALIDA IS NULL OR FECHASALIDA > DATEADD(DAY,-30, GETDATE()))
    `;

    const operatorsResult = await sqlPool.request().query(operatorsQuery);
    const operators = operatorsResult.recordset;

    let inserted = 0;
    let updated = 0;

    for (const operator of operators) {
      // Verificar si ya existe el empleado
      const existing = await pool.query(
        'SELECT id FROM employees WHERE empleado_id = $1 AND employee_type = $2',
        [operator.EMPLEADO_ID, 'operator']
      );

      if (existing.rows.length > 0) {
        // Actualizar si ha cambiado
        const updateResult = await pool.query(`
          UPDATE employees 
          SET 
            cargo = $1,
            empleado_identificacion = $2,
            nombre_operador = $3,
            empleado_fecha_ingreso = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE empleado_id = $5 AND employee_type = $6
          RETURNING id
        `, [
          operator.CARGO,
          operator.EMPLEADO_IDENTIFICACION,
          operator.NOMBRE_OPERADOR,
          operator.EMPLEADO_FECHA_INGRESO,
          operator.EMPLEADO_ID,
          'operator'
        ]);

        if (updateResult.rows.length > 0) {
          updated++;
        }
      } else {
        // Insertar nuevo
        await pool.query(`
          INSERT INTO employees (
            employee_type,
            cargo,
            empleado_id,
            empleado_identificacion,
            nombre_operador,
            empleado_fecha_ingreso
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          'operator',
          operator.CARGO,
          operator.EMPLEADO_ID,
          operator.EMPLEADO_IDENTIFICACION,
          operator.NOMBRE_OPERADOR,
          operator.EMPLEADO_FECHA_INGRESO
        ]);
        inserted++;
      }
    }

    // Eliminar empleados que ya no existen en la fuente externa
    const allOperatorIds = operators.map(op => op.EMPLEADO_ID);
    if (allOperatorIds.length > 0) {
      const placeholders = allOperatorIds.map((_, i) => `$${i + 1}`).join(',');
      await pool.query(
        `DELETE FROM employees WHERE employee_type = 'operator' AND empleado_id NOT IN (${placeholders})`,
        allOperatorIds
      );
    } else {
      // Si no hay operadores, eliminar todos los operadores locales
      await pool.query('DELETE FROM employees WHERE employee_type = $1', ['operator']);
    }

    return { 
      success: true, 
      message: `Operadores sincronizados: ${inserted} nuevos, ${updated} actualizados` 
    };
  } catch (error) {
    console.error('Error sincronizando operadores:', error);
    return { success: false, message: 'Error al sincronizar operadores' };
  }
};

export const syncSupervisors = async () => {
  try {
    const sqlPool = await connectToSqlServer();
    
    // Consulta para supervisores
    const supervisorsQuery = `
      SELECT 
        CARGO.NOMBRE AS 'CARGO',
        EMPLEADO.EMPLEADOID AS 'EMPLEADO_ID',
        PERSONA.IDENTIFICACION AS 'EMPLEADO_IDENTIFICACION',
        PERSONA.APELLIDOS + ' ' + PERSONA.NOMBRES AS 'NOMBRE_OPERADOR',
        EMPLEADO.FECHAINGRESO AS 'EMPLEADO_FECHA_INGRESO'
      FROM dbo.Personas AS PERSONA
      INNER JOIN dbo.Empleados AS EMPLEADO ON (PERSONA.PERSONAID = EMPLEADO.PERSONAID)
      INNER JOIN dbo.CARGOS AS CARGO ON (EMPLEADO.CARGOID = CARGO.CARGOID)
      WHERE CARGO.NOMBRE LIKE '%SUPERVI%' AND (FECHASALIDA IS NULL OR FECHASALIDA > DATEADD(DAY,-30, GETDATE()))
    `;

    const supervisorsResult = await sqlPool.request().query(supervisorsQuery);
    const supervisors = supervisorsResult.recordset;

    let inserted = 0;
    let updated = 0;

    for (const supervisor of supervisors) {
      // Verificar si ya existe el empleado
      const existing = await pool.query(
        'SELECT id FROM employees WHERE empleado_id = $1 AND employee_type = $2',
        [supervisor.EMPLEADO_ID, 'supervisor']
      );

      if (existing.rows.length > 0) {
        // Actualizar si ha cambiado
        const updateResult = await pool.query(`
          UPDATE employees 
          SET 
            cargo = $1,
            empleado_identificacion = $2,
            nombre_operador = $3,
            empleado_fecha_ingreso = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE empleado_id = $5 AND employee_type = $6
          RETURNING id
        `, [
          supervisor.CARGO,
          supervisor.EMPLEADO_IDENTIFICACION,
          supervisor.NOMBRE_OPERADOR,
          supervisor.EMPLEADO_FECHA_INGRESO,
          supervisor.EMPLEADO_ID,
          'supervisor'
        ]);

        if (updateResult.rows.length > 0) {
          updated++;
        }
      } else {
        // Insertar nuevo
        await pool.query(`
          INSERT INTO employees (
            employee_type,
            cargo,
            empleado_id,
            empleado_identificacion,
            nombre_operador,
            empleado_fecha_ingreso
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          'supervisor',
          supervisor.CARGO,
          supervisor.EMPLEADO_ID,
          supervisor.EMPLEADO_IDENTIFICACION,
          supervisor.NOMBRE_OPERADOR,
          supervisor.EMPLEADO_FECHA_INGRESO
        ]);
        inserted++;
      }
    }

    // Eliminar empleados que ya no existen en la fuente externa
    const allSupervisorIds = supervisors.map(sup => sup.EMPLEADO_ID);
    if (allSupervisorIds.length > 0) {
      const placeholders = allSupervisorIds.map((_, i) => `$${i + 1}`).join(',');
      await pool.query(
        `DELETE FROM employees WHERE employee_type = 'supervisor' AND empleado_id NOT IN (${placeholders})`,
        allSupervisorIds
      );
    } else {
      // Si no hay supervisores, eliminar todos los supervisores locales
      await pool.query('DELETE FROM employees WHERE employee_type = $1', ['supervisor']);
    }

    return { 
      success: true, 
      message: `Supervisores sincronizados: ${inserted} nuevos, ${updated} actualizados` 
    };
  } catch (error) {
    console.error('Error sincronizando supervisores:', error);
    return { success: false, message: 'Error al sincronizar supervisores' };
  }
};

export const syncAllEmployees = async () => {
  try {
    const operatorsResult = await syncOperators();
    const supervisorsResult = await syncSupervisors();

    return {
      success: operatorsResult.success && supervisorsResult.success,
      message: `${operatorsResult.message}, ${supervisorsResult.message}`
    };
  } catch (error) {
    console.error('Error general en sincronización:', error);
    return { success: false, message: 'Error general en sincronización' };
  }
};