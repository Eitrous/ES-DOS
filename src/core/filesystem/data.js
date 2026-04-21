export const ROOT_PATH = 'C:\\';

export const FILE_SYSTEM = {
  type: 'DIR',
  children: {
    WINDOWS: {
      type: 'DIR',
      children: {
        SYSTEM32: {
          type: 'DIR',
          children: {
            DRIVERS: {
              type: 'DIR',
              children: {},
            },
          },
        },
      },
    },
    DOCUMENTS: {
      type: 'DIR',
      children: {
        'RESUME.TXT': {
          type: 'TXT',
          size: '1024',
          content: 'this is RESUME.TXT',
        },
        'README.TXT': {
          type: 'TXT',
          size: '18',
          content: 'this is README.TXT',
        },
      },
    },
  },
};
