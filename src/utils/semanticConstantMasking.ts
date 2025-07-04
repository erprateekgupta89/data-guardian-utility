
import { DataType } from "@/types";
import { randomString, randomNumber } from "./maskingHelpers";

// Interface for constant value metadata
export interface ConstantValueMetadata {
  originalValue: string;
  detectedType: string;
  context: string;
  isNumeric: boolean;
  isBoolean: boolean;
  hasSpecialChars: boolean;
  length: number;
}

export class SemanticConstantMasking {
  // Analyze the constant value to determine its semantic type and context
  analyzeConstantValue(value: string): ConstantValueMetadata {
    const trimmedValue = value.trim();
    const lowerValue = trimmedValue.toLowerCase();
    
    // Detect numeric values
    const isNumeric = /^\d+(\.\d+)?$/.test(trimmedValue);
    
    // Detect boolean values
    const isBoolean = ['true', 'false', 'yes', 'no', '1', '0'].includes(lowerValue);
    
    // Detect special characters
    const hasSpecialChars = /[^a-zA-Z0-9\s]/.test(trimmedValue);
    
    // Determine context based on patterns and keywords
    let context = this.determineContext(trimmedValue, lowerValue);
    
    return {
      originalValue: value,
      detectedType: this.detectSemanticType(trimmedValue, lowerValue),
      context,
      isNumeric,
      isBoolean,
      hasSpecialChars,
      length: trimmedValue.length
    };
  }

  private determineContext(value: string, lowerValue: string): string {
    // Campaign/Marketing related
    if (lowerValue.includes('campaign') || lowerValue.includes('promotion') || lowerValue.includes('marketing')) {
      return 'campaign';
    }
    
    // Status/State related
    if (['active', 'inactive', 'pending', 'complete', 'draft', 'published'].includes(lowerValue)) {
      return 'status';
    }
    
    // Department/Organization related
    if (['sales', 'marketing', 'hr', 'finance', 'it', 'support', 'admin'].includes(lowerValue)) {
      return 'department';
    }
    
    // Priority/Level related
    if (['high', 'medium', 'low', 'urgent', 'normal', 'critical'].includes(lowerValue)) {
      return 'priority';
    }
    
    // Category/Type related
    if (lowerValue.includes('type') || lowerValue.includes('category') || lowerValue.includes('class')) {
      return 'category';
    }
    
    // Product/Service related
    if (lowerValue.includes('product') || lowerValue.includes('service') || lowerValue.includes('item')) {
      return 'product';
    }
    
    return 'general';
  }

  private detectSemanticType(value: string, lowerValue: string): string {
    // ID/Code patterns
    if (/^[A-Z]{2,4}\d{2,6}$/.test(value) || /^\d{4,}$/.test(value)) {
      return 'identifier';
    }
    
    // Version patterns
    if (/^v?\d+\.\d+(\.\d+)?$/i.test(value)) {
      return 'version';
    }
    
    // Date patterns
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
      return 'date';
    }
    
    // Email patterns
    if (/@/.test(value) && /\.[a-z]{2,}$/i.test(value)) {
      return 'email';
    }
    
    // URL patterns
    if (/^https?:\/\//.test(lowerValue)) {
      return 'url';
    }
    
    // Name patterns (Title Case)
    if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(value)) {
      return 'name';
    }
    
    return 'text';
  }

  // Generate semantically appropriate masked value
  generateSemanticMaskedValue(metadata: ConstantValueMetadata, dataType: DataType): string {
    console.log(`🎯 Generating semantic masked value for: "${metadata.originalValue}" (type: ${metadata.detectedType}, context: ${metadata.context})`);
    
    // Handle based on detected semantic type first
    switch (metadata.detectedType) {
      case 'identifier':
        return this.generateIdentifier(metadata);
      
      case 'version':
        return this.generateVersion();
      
      case 'date':
        return this.generateMaskedDate(metadata.originalValue);
      
      case 'email':
        return this.generateMaskedEmail();
      
      case 'url':
        return this.generateMaskedUrl();
      
      case 'name':
        return this.generateMaskedName(metadata);
    }
    
    // Handle based on context
    switch (metadata.context) {
      case 'campaign':
        return this.generateCampaignName();
      
      case 'status':
        return this.generateStatus();
      
      case 'department':
        return this.generateDepartment();
      
      case 'priority':
        return this.generatePriority();
      
      case 'category':
        return this.generateCategory();
      
      case 'product':
        return this.generateProductName();
    }
    
    // Handle based on data type
    switch (dataType) {
      case 'Bool':
        return Math.random() > 0.5 ? 'true' : 'false';
      
      case 'Int':
        if (metadata.isNumeric) {
          const originalNum = parseInt(metadata.originalValue);
          return randomNumber(Math.max(1, originalNum - 50), originalNum + 50).toString();
        }
        return randomNumber(100, 999).toString();
      
      case 'Float':
        if (metadata.isNumeric) {
          const originalNum = parseFloat(metadata.originalValue);
          const newNum = Math.random() * (originalNum * 1.5 - originalNum * 0.5) + originalNum * 0.5;
          const decimalPlaces = (metadata.originalValue.split('.')[1] || '').length || 2;
          return newNum.toFixed(decimalPlaces);
        }
        return (Math.random() * 100).toFixed(2);
      
      case 'Company':
        return this.generateCompanyName();
      
      case 'Name':
        return this.generateMaskedName(metadata);
      
      default:
        return this.generateGenericText(metadata);
    }
  }

  private generateIdentifier(metadata: ConstantValueMetadata): string {
    const original = metadata.originalValue;
    
    // Pattern: ABC123 -> DEF456
    if (/^[A-Z]{2,4}\d{2,6}$/.test(original)) {
      const letterPart = original.match(/^[A-Z]+/)?.[0] || 'ABC';
      const numberPart = original.match(/\d+$/)?.[0] || '123';
      
      const newLetters = Array(letterPart.length).fill(0)
        .map(() => String.fromCharCode(65 + Math.floor(Math.random() * 26)))
        .join('');
      const newNumbers = randomNumber(
        Math.max(100, parseInt(numberPart) - 100),
        parseInt(numberPart) + 100
      ).toString().padStart(numberPart.length, '0');
      
      return newLetters + newNumbers;
    }
    
    // Pattern: 123456 -> 789012
    if (/^\d{4,}$/.test(original)) {
      return randomNumber(
        Math.max(1000, parseInt(original) - 1000),
        parseInt(original) + 1000
      ).toString().padStart(original.length, '0');
    }
    
    return `ID_${randomNumber(1000, 9999)}`;
  }

  private generateVersion(): string {
    const major = randomNumber(1, 5);
    const minor = randomNumber(0, 9);
    const patch = randomNumber(0, 9);
    return `${major}.${minor}.${patch}`;
  }

  private generateMaskedDate(originalDate: string): string {
    const year = randomNumber(2020, 2024);
    const month = randomNumber(1, 12).toString().padStart(2, '0');
    const day = randomNumber(1, 28).toString().padStart(2, '0');
    
    if (originalDate.includes('-')) {
      return `${year}-${month}-${day}`;
    } else if (originalDate.includes('/')) {
      return `${month}/${day}/${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  private generateMaskedEmail(): string {
    const usernames = ['user', 'test', 'demo', 'sample', 'example'];
    const domains = ['example.com', 'test.org', 'demo.net', 'sample.co'];
    
    const username = usernames[Math.floor(Math.random() * usernames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const randomNum = randomNumber(1, 999);
    
    return `${username}${randomNum}@${domain}`;
  }

  private generateMaskedUrl(): string {
    const domains = ['example.com', 'test-site.org', 'demo-app.net', 'sample-page.co'];
    const paths = ['home', 'about', 'products', 'services', 'contact'];
    
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const path = paths[Math.floor(Math.random() * paths.length)];
    
    return `https://${domain}/${path}`;
  }

  private generateMaskedName(metadata: ConstantValueMetadata): string {
    const firstNames = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery', 'Quinn'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore'];
    
    if (metadata.originalValue.includes(' ')) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      return `${firstName} ${lastName}`;
    }
    
    return firstNames[Math.floor(Math.random() * firstNames.length)];
  }

  private generateCampaignName(): string {
    const adjectives = ['Spring', 'Summer', 'Holiday', 'Premium', 'Special', 'Elite', 'Pro', 'Ultimate'];
    const nouns = ['Campaign', 'Promotion', 'Drive', 'Initiative', 'Program', 'Project', 'Event'];
    
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const year = randomNumber(2023, 2025);
    
    return `${adj} ${noun} ${year}`;
  }

  private generateStatus(): string {
    const statuses = ['Active', 'Pending', 'Complete', 'In Progress', 'On Hold', 'Approved', 'Draft'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private generateDepartment(): string {
    const departments = ['Operations', 'Development', 'Quality', 'Research', 'Strategy', 'Analytics', 'Planning'];
    return departments[Math.floor(Math.random() * departments.length)];
  }

  private generatePriority(): string {
    const priorities = ['High', 'Medium', 'Low', 'Critical', 'Normal', 'Urgent'];
    return priorities[Math.floor(Math.random() * priorities.length)];
  }

  private generateCategory(): string {
    const categories = ['Type A', 'Type B', 'Category X', 'Category Y', 'Class 1', 'Class 2', 'Standard'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  private generateProductName(): string {
    const adjectives = ['Pro', 'Plus', 'Premium', 'Standard', 'Basic', 'Advanced', 'Elite'];
    const products = ['Widget', 'Tool', 'Solution', 'Service', 'Platform', 'System', 'Application'];
    
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const product = products[Math.floor(Math.random() * products.length)];
    
    return `${adj} ${product}`;
  }

  private generateCompanyName(): string {
    const companies = [
      'Acme Corp', 'Global Solutions', 'Tech Innovations', 'Dynamic Systems',
      'Premier Services', 'Advanced Technologies', 'Strategic Partners', 'Elite Enterprises'
    ];
    return companies[Math.floor(Math.random() * companies.length)];
  }

  private generateGenericText(metadata: ConstantValueMetadata): string {
    // Preserve similar structure but change content
    if (metadata.hasSpecialChars) {
      const baseText = randomString(Math.max(3, metadata.length - 2));
      return `${baseText}_${randomNumber(10, 99)}`;
    }
    
    if (metadata.length <= 5) {
      return randomString(metadata.length).toUpperCase();
    }
    
    if (metadata.length <= 15) {
      const words = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
      return words[Math.floor(Math.random() * words.length)];
    }
    
    return `Generated Text ${randomNumber(100, 999)}`;
  }
}
