
import { DataType } from "@/types";
import { randomString, randomNumber } from "./maskingHelpers";

// Personal Information masking
const maskPersonalInfo = (value: string, dataType: "Name" | "First Name" | "Last Name"): string => {
  const names = [
    'John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Robert', 'Jessica',
    'William', 'Jennifer', 'Richard', 'Linda', 'Thomas', 'Patricia', 'Daniel',
    'Elizabeth', 'Matthew', 'Susan', 'Anthony', 'Karen'
  ];
  
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller',
    'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White',
    'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson'
  ];

  if (dataType === 'First Name' || !value.includes(' ')) {
    return names[Math.floor(Math.random() * names.length)];
  }
  
  return `${names[Math.floor(Math.random() * names.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
};

// Location data masking
const maskLocationData = (value: string, dataType: "Address" | "City" | "State" | "Country"): string => {
  if (dataType === 'Address') {
    const streetNumbers = ['123', '456', '789', '101', '202', '305', '427', '550'];
    const streetNames = ['Main St', 'Oak Ave', 'Maple Rd', 'Pine Ln', 'Cedar Blvd', 'Park Ave', 'Washington St'];
    return `${streetNumbers[Math.floor(Math.random() * streetNumbers.length)]} ${streetNames[Math.floor(Math.random() * streetNames.length)]}`;
  }

  if (dataType === 'City') {
    const cities = [
      'Springfield', 'Franklin', 'Greenville', 'Bristol', 'Clinton',
      'Madison', 'Georgetown', 'Salem', 'Fairview', 'Riverside'
    ];
    return cities[Math.floor(Math.random() * cities.length)];
  }

  if (dataType === 'State') {
    const states = [
      'California', 'Texas', 'Florida', 'New York', 'Pennsylvania',
      'Illinois', 'Ohio', 'Georgia', 'North Carolina', 'Michigan'
    ];
    return states[Math.floor(Math.random() * states.length)];
  }

  const countries = [
    'United States', 'Canada', 'United Kingdom', 'Australia',
    'Germany', 'France', 'Japan', 'India', 'Brazil', 'Mexico'
  ];
  return countries[Math.floor(Math.random() * countries.length)];
};

// Date and time masking
const maskDateTime = (value: string, dataType: "Date" | "Time" | "Date Time" | "Date of birth"): string => {
  if (dataType === 'Time') {
    const hour = randomNumber(0, 23).toString().padStart(2, '0');
    const minute = randomNumber(0, 59).toString().padStart(2, '0');
    const second = randomNumber(0, 59).toString().padStart(2, '0');
    
    if (value.includes(':')) {
      const parts = value.split(':');
      if (parts.length === 2) {
        return `${hour}:${minute}`;
      }
      return `${hour}:${minute}:${second}`;
    }
    return value;
  }

  if (dataType === 'Date Time') {
    const datePart = maskDateTime(value.split(' ')[0], 'Date');
    const timePart = maskDateTime(value.split(' ')[1], 'Time');
    return `${datePart} ${timePart}`;
  }

  // Handle dates
  const yearStart = dataType === 'Date of birth' ? 1950 : 1980;
  const yearEnd = dataType === 'Date of birth' ? 2005 : 2023;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const year = randomNumber(yearStart, yearEnd);
    const month = randomNumber(1, 12).toString().padStart(2, '0');
    const day = randomNumber(1, 28).toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const month = randomNumber(1, 12);
    const day = randomNumber(1, 28);
    const year = randomNumber(yearStart, yearEnd);
    return `${month}/${day}/${year}`;
  } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
    const month = randomNumber(1, 12);
    const day = randomNumber(1, 28);
    const year = randomNumber(yearStart, yearEnd);
    return `${month}-${day}-${year}`;
  }
  
  return value;
};

export { maskPersonalInfo, maskLocationData, maskDateTime };
