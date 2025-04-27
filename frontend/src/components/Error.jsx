import React from 'react';
import { X } from 'linc-react';

const Error = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-red-500 text-white rounded-lg shadow-lg max-w-md">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <p className="font-medium">{message}</p>
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 text-white hover:text-gray-200"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Error;
