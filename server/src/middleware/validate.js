/**
 * Request validation middleware factory using Zod
 * 
 * @param {z.ZodSchema} schema - Zod validation schema to verify against
 * @returns {Function} Express middleware function
 */
export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Parse and validate the incoming request body
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        const details = error.errors.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message
        }));

        return res.status(400).json({
          error: 'Validation failed',
          details
        });
      }

      next(error);
    }
  };
};
