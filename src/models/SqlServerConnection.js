import sql from 'mssql';

const config = {
  user: 'usersaco1',
  password: 'sacoplast2021',
  server: '192.168.1.92',
  database: 'SACO_0990868107001',
  options: {
    encrypt: false, // Configura según tus necesidades
    trustServerCertificate: true // Solo para desarrollo
  }
};

export const connectToSqlServer = async () => {
  try {
    const pool = await sql.connect(config); // ✅ Corregido: era sql.connect pool
    return pool;
  } catch (error) {
    console.error('Error conectando a SQL Server:', error);
    throw error;
  }
};