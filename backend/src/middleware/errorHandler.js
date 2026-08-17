const notFound = (req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => {
  if (err.code === '23505') {
    const field = err.detail?.match(/\((.+?)\)/)?.[1] || 'campo';
    return res.status(409).json({ error: `Valor duplicado: ${field}` });
  }
  if (err.code === '23503') return res.status(400).json({ error: 'Referência inválida.' });
  if (err.code === '23502') return res.status(400).json({ error: `Campo obrigatório: ${err.column}` });

  const status = err.statusCode || err.status || 500;
  console.error('[ERROR]', err.message, err.stack?.split('\n')[1]);
  res.status(status).json({
    error: status === 500 ? 'Erro interno do servidor.' : err.message,
    ...(process.env.NODE_ENV === 'development' ? { detail: err.message } : {}),
  });
};

module.exports = { notFound, errorHandler };
