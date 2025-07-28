import React from 'react';

const PasswordStrength = ({ password }) => {
  const getStrength = (password) => {
    let strength = 0;
    
    if (password.length >= 6) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    
    return strength;
  };

  const getStrengthText = (strength) => {
    switch (strength) {
      case 0:
      case 1:
        return { text: 'Very Weak', color: 'text-red-600', bg: 'bg-red-200' };
      case 2:
        return { text: 'Weak', color: 'text-orange-600', bg: 'bg-orange-200' };
      case 3:
        return { text: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-200' };
      case 4:
        return { text: 'Good', color: 'text-blue-600', bg: 'bg-blue-200' };
      case 5:
        return { text: 'Strong', color: 'text-green-600', bg: 'bg-green-200' };
      default:
        return { text: '', color: '', bg: '' };
    }
  };

  if (!password) return null;

  const strength = getStrength(password);
  const strengthInfo = getStrengthText(strength);

  return (
    <div className="mt-1">
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${strengthInfo.bg}`}
            style={{ width: `${(strength / 5) * 100}%` }}
          ></div>
        </div>
        <span className={`text-xs font-medium ${strengthInfo.color}`}>
          {strengthInfo.text}
        </span>
      </div>
    </div>
  );
};

export default PasswordStrength;
