/**
 * Multer configuration for file uploads
 * Supports file uploads up to MAX_FILE_SIZE (default: 10MB)
 * 
 * Note: This uses process.env directly because decorators cannot access
 * dependency injection. For production, set MAX_FILE_SIZE in environment variables.
 */
export const getMulterMemoryConfig = () => {
  // Get max file size from env or default to 10MB (10485760 bytes)
  // You can set MAX_FILE_SIZE in .env file (value in bytes)
  // Example: MAX_FILE_SIZE=10485760 for 10MB
  const maxFileSize = parseInt(
    process.env.MAX_FILE_SIZE || '10485760', // 10MB in bytes
  );

  return {
    storage: undefined, // Use memory storage (default for multer)
    limits: {
      fileSize: maxFileSize,
      files: 1, // Only allow single file upload
    },
    fileFilter: (req, file, cb) => {
      // Only allow image files
      const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/svg+xml',
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            `Loại file không hợp lệ. Chỉ chấp nhận file ảnh. Loại file nhận được: ${file.mimetype}`,
          ),
          false,
        );
      }
    },
  };
};

