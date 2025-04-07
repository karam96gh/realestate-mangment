// Generate password 
// Function to generate a random password
const generatePassword = (length = 8) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let password = '';
    
    // Ensure we have at least one of each required character type
    password += getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); // Uppercase
    password += getRandomChar('abcdefghijklmnopqrstuvwxyz'); // Lowercase
    password += getRandomChar('0123456789'); // Number
    password += getRandomChar('!@#$%^&*()_+'); // Special character
    
    // Fill the rest of the password
    for (let i = password.length; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    
    // Shuffle the password characters
    return shuffleString(password);
  };
  
  // Helper function to get a random character from a string
  const getRandomChar = (str) => {
    const randomIndex = Math.floor(Math.random() * str.length);
    return str[randomIndex];
  };
  
  // Helper function to shuffle a string
  const shuffleString = (str) => {
    const array = str.split('');
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join('');
  };
  
  module.exports = generatePassword;