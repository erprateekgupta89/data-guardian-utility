
import { DataType } from "@/types";
import { randomString, randomNumber } from "./maskingHelpers";

// Personal Information masking with improved context preservation
const maskPersonalInfo = (value: string, dataType: "Name" | "First Name" | "Last Name"): string => {
  // Use capitalization pattern of original value
  const isAllCaps = value === value.toUpperCase();
  const isFirstLetterCap = value[0] === value[0].toUpperCase();
  
  const firstNames = [
    'John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Robert', 'Jessica',
    'William', 'Jennifer', 'Richard', 'Linda', 'Thomas', 'Patricia', 'Daniel',
    'Elizabeth', 'Matthew', 'Susan', 'Anthony', 'Karen'
  ];
  
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller',
    'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White',
    'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson'
  ];

  // Select random name(s)
  let result = '';
  if (dataType === 'First Name' || !value.includes(' ')) {
    result = firstNames[Math.floor(Math.random() * firstNames.length)];
  } else if (dataType === 'Last Name') {
    result = lastNames[Math.floor(Math.random() * lastNames.length)];
  } else {
    // For full names, match the pattern (first middle? last)
    const parts = value.split(' ');
    const firstNameIndex = Math.floor(Math.random() * firstNames.length);
    const lastNameIndex = Math.floor(Math.random() * lastNames.length);
    
    if (parts.length === 2) {
      result = `${firstNames[firstNameIndex]} ${lastNames[lastNameIndex]}`;
    } else if (parts.length === 3) {
      // If original has 3 parts, include a middle name or initial
      const middleInitial = firstNames[Math.floor(Math.random() * firstNames.length)][0] + '.';
      result = `${firstNames[firstNameIndex]} ${middleInitial} ${lastNames[lastNameIndex]}`;
    } else if (parts.length > 3) {
      // For more complex names, just use first + last
      result = `${firstNames[firstNameIndex]} ${lastNames[lastNameIndex]}`;
    }
  }
  
  // Apply original capitalization pattern
  if (isAllCaps) {
    return result.toUpperCase();
  } else if (isFirstLetterCap) {
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  
  return result;
};

// Location data masking with improved format preservation
const maskLocationData = (value: string, dataType: "Address" | "City" | "State" | "Country"): string => {
  // Preserve capitalization pattern
  const isAllCaps = value === value.toUpperCase();
  
  let result = '';
  
  if (dataType === 'Address') {
    // Analyze original address structure
    const hasApt = /apt|suite|unit|#/i.test(value);
    const hasStreetType = /st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|way|place|pl/i.test(value);
    
    const streetNumbers = ['123', '456', '789', '101', '202', '305', '427', '550', '631', '777'];
    const streetNames = ['Main', 'Oak', 'Maple', 'Pine', 'Cedar', 'Park', 'Washington', 'Lake', 'River', 'Hill'];
    const streetTypes = ['St', 'Ave', 'Rd', 'Blvd', 'Ln', 'Dr', 'Way', 'Pl'];
    
    result = `${streetNumbers[Math.floor(Math.random() * streetNumbers.length)]} ${
      streetNames[Math.floor(Math.random() * streetNames.length)]
    } ${hasStreetType ? streetTypes[Math.floor(Math.random() * streetTypes.length)] : ''}`;
    
    if (hasApt) {
      result += `, Apt ${randomNumber(1, 50)}`;
    }
  } else if (dataType === 'City') {
    const cities = [
      'Springfield', 'Franklin', 'Greenville', 'Bristol', 'Clinton',
      'Madison', 'Georgetown', 'Salem', 'Fairview', 'Riverside',
      'Arlington', 'Oakland', 'Centerville', 'Oakwood', 'Newport'
    ];
    result = cities[Math.floor(Math.random() * cities.length)];
  } else if (dataType === 'State') {
    const states = [
      'California', 'Texas', 'Florida', 'New York', 'Pennsylvania',
      'Illinois', 'Ohio', 'Georgia', 'North Carolina', 'Michigan',
      'Washington', 'Arizona', 'Massachusetts', 'Colorado', 'Maryland'
    ];
    
    // If original value is abbreviated (like CA, TX), use abbreviations
    if (value.length <= 2) {
      const stateAbbrs = [
        'CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI',
        'WA', 'AZ', 'MA', 'CO', 'MD'
      ];
      result = stateAbbrs[Math.floor(Math.random() * stateAbbrs.length)];
    } else {
      result = states[Math.floor(Math.random() * states.length)];
    }
  } else { // Country
    const countries = [
      'United States', 'Canada', 'United Kingdom', 'Australia',
      'Germany', 'France', 'Japan', 'India', 'Brazil', 'Mexico',
      'Spain', 'Italy', 'Netherlands', 'Sweden', 'South Korea'
    ];
    
    // If original value is abbreviated (like US, UK), use abbreviations
    if (value.length <= 2) {
      const countryAbbrs = [
        'US', 'CA', 'UK', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX',
        'ES', 'IT', 'NL', 'SE', 'KR'
      ];
      result = countryAbbrs[Math.floor(Math.random() * countryAbbrs.length)];
    } else {
      result = countries[Math.floor(Math.random() * countries.length)];
    }
  }
  
  // Apply original capitalization pattern
  if (isAllCaps) {
    return result.toUpperCase();
  }
  
  return result;
};

// Date and time masking with format preservation
const maskDateTime = (value: string, dataType: "Date" | "Time" | "Date Time" | "Date of birth"): string => {
  // Preserve the exact format of the original date/time
  if (dataType === 'Time') {
    const timeFormat = value.trim();
    
    // Extract format information
    let is24Hour = false;
    if (timeFormat.includes(':')) {
      const hourPart = parseInt(timeFormat.split(':')[0]);
      is24Hour = hourPart > 12;
    }
    
    const hasSeconds = (timeFormat.match(/:/g) || []).length > 1;
    const hasAmPm = /am|pm|AM|PM/.test(timeFormat);
    
    const hour = is24Hour ? 
      randomNumber(0, 23).toString().padStart(2, '0') : 
      randomNumber(1, 12).toString().padStart(2, '0');
    const minute = randomNumber(0, 59).toString().padStart(2, '0');
    const second = randomNumber(0, 59).toString().padStart(2, '0');
    
    let result = `${hour}:${minute}`;
    if (hasSeconds) {
      result += `:${second}`;
    }
    
    if (hasAmPm) {
      const amPm = Math.random() > 0.5 ? 'AM' : 'PM';
      // Preserve case of AM/PM
      if (timeFormat.includes('am') || timeFormat.includes('pm')) {
        result += ` ${amPm.toLowerCase()}`;
      } else {
        result += ` ${amPm}`;
      }
    }
    
    return result;
  }

  if (dataType === 'Date Time') {
    const dateTimeParts = value.split(/\s+|T/);
    const datePart = maskDateTime(dateTimeParts[0], 'Date');
    let timePart = '';
    
    if (dateTimeParts.length > 1) {
      timePart = maskDateTime(dateTimeParts.slice(1).join(' '), 'Time');
    }
    
    // Preserve original separator (T or space)
    const separator = value.includes('T') ? 'T' : ' ';
    return `${datePart}${separator}${timePart}`;
  }

  // Handle dates with format preservation
  const yearStart = dataType === 'Date of birth' ? 1950 : 2020;
  const yearEnd = dataType === 'Date of birth' ? 2005 : 2025;

  // Detect format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) { // YYYY-MM-DD
    const year = randomNumber(yearStart, yearEnd);
    const month = randomNumber(1, 12).toString().padStart(2, '0');
    const day = randomNumber(1, 28).toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) { // MM/DD/YYYY
    const month = randomNumber(1, 12);
    const day = randomNumber(1, 28);
    const year = randomNumber(yearStart, yearEnd);
    
    // Preserve padding
    const monthStr = value.split('/')[0].length === 1 ? month.toString() : month.toString().padStart(2, '0');
    const dayStr = value.split('/')[1].length === 1 ? day.toString() : day.toString().padStart(2, '0');
    
    return `${monthStr}/${dayStr}/${year}`;
  } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) { // MM-DD-YYYY
    const month = randomNumber(1, 12);
    const day = randomNumber(1, 28);
    const year = randomNumber(yearStart, yearEnd);
    
    // Preserve padding
    const monthStr = value.split('-')[0].length === 1 ? month.toString() : month.toString().padStart(2, '0');
    const dayStr = value.split('-')[1].length === 1 ? day.toString() : day.toString().padStart(2, '0');
    
    return `${monthStr}-${dayStr}-${year}`;
  } else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(value)) { // MM/DD/YY
    const month = randomNumber(1, 12);
    const day = randomNumber(1, 28);
    const year = randomNumber(yearStart, yearEnd) % 100;
    
    // Preserve padding
    const monthStr = value.split('/')[0].length === 1 ? month.toString() : month.toString().padStart(2, '0');
    const dayStr = value.split('/')[1].length === 1 ? day.toString() : day.toString().padStart(2, '0');
    const yearStr = year.toString().padStart(2, '0');
    
    return `${monthStr}/${dayStr}/${yearStr}`;
  }
  
  // Default fallback - use original format
  return value.replace(/\d+/g, (match) => {
    return randomNumber(1, Math.pow(10, match.length) - 1).toString().padStart(match.length, '0');
  });
};

export { maskPersonalInfo, maskLocationData, maskDateTime };
