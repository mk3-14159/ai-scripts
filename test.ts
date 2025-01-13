// buggyFunctions.ts

// Custom error types for better error handling
class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

// Interfaces and Types
interface User {
    name: string;
    age: number;
}

interface UserProfile {
    id: string;
    profile?: {
        name: string;
        email?: string;
        phone?: string;
    };
}

const enum Status {
    Active = "ACTIVE",
    Inactive = "INACTIVE"
}

// Type guard functions
function isString(value: unknown): value is string {
    return typeof value === "string";
}

function isNumber(value: unknown): value is number {
    return typeof value === "number" && !Number.isNaN(value);
}

// 1. Sum Function
export function sum(a: number, b: number): number {
    if (!isNumber(a) || !isNumber(b)) {
        throw new ValidationError('Arguments must be valid numbers');
    }
    return a + b;
}

// 2. Array Filtering Function
export function filterEvenNumbers(numbers: readonly number[]): number[] {
    if (!Array.isArray(numbers)) {
        throw new ValidationError('Input must be an array');
    }
    return numbers.filter((num): num is number => 
        isNumber(num) && num % 2 === 0
    );
}

// 3. Greet Function with Default Parameter
export function greet(name: string, greeting: string = "Hello"): string {
    if (!isString(name) || name.trim() === "") {
        throw new ValidationError('Name must be a non-empty string');
    }
    if (!isString(greeting)) {
        throw new ValidationError('Greeting must be a string');
    }
    return `${greeting}, ${name.trim()}!`;
}

// 4. User Name Function
export function getUserName(user: User | null | undefined): string {
    if (!user) {
        throw new ValidationError('User cannot be null or undefined');
    }
    return user.name;
}

// 5. Fetch Data Function
export async function fetchData<T>(url: string, timeout = 5000): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data as T;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fetch failed: ${error.message}`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

// 6. Parse Number Function
export function parseNumber(input: string): number {
    if (!isString(input)) {
        throw new ValidationError('Input must be a string');
    }
    
    const parsed = Number(input);
    if (Number.isNaN(parsed)) {
        throw new ValidationError(`Invalid number format: ${input}`);
    }
    
    return parsed;
}

// 7. Find Max Function
export function findMax(numbers: readonly number[]): number {
    if (!Array.isArray(numbers)) {
        throw new ValidationError('Input must be an array');
    }
    if (numbers.length === 0) {
        throw new ValidationError('Cannot find maximum of empty array');
    }
    
    const validNumbers = numbers.filter(isNumber);
    if (validNumbers.length === 0) {
        throw new ValidationError('Array contains no valid numbers');
    }
    
    return Math.max(...validNumbers);
}

// 8. Print Value Function
export function printValue(value: string | number): void {
    if (isString(value)) {
        console.log(value.toUpperCase());
    } else if (isNumber(value)) {
        console.log(value.toFixed(2));
    } else {
        throw new ValidationError('Value must be either string or number');
    }
}

// 9. Array Mutation Function (now immutable)
export function addToArray<T>(arr: readonly T[], value: T): T[] {
    if (!Array.isArray(arr)) {
        throw new ValidationError('First argument must be an array');
    }
    return [...arr, value];
}

// 10. Optional Chaining Function
export function getUserNameFromProfile(user: UserProfile): string {
    if (!user.id) {
        throw new ValidationError('User must have an ID');
    }
    return user.profile?.name ?? "Unknown";
}

// 11. Status Check Function
export function checkStatus(status: Status): boolean {
    return status === Status.Active;
}

// 12. Recursive Factorial Function
export function factorial(n: number): bigint {
    if (!Number.isInteger(n)) {
        throw new ValidationError('Input must be an integer');
    }
    if (n < 0) {
        throw new ValidationError('Input must be non-negative');
    }
    if (n === 0) return 1n;
    
    return BigInt(n) * factorial(n - 1);
}

// Example usage
if (process.env.NODE_ENV === 'development') {
    // Safe example values
    const numbers = [1, 2, 3, 4, 5];
    const validUser: User = { name: "Alice", age: 30 };
    const validProfile: UserProfile = { id: "123", profile: { name: "Bob" } };

    try {
        console.log("Sum Result:", sum(5, 10));
        console.log("Filtered Numbers:", filterEvenNumbers(numbers));
        console.log("Greeting:", greet("Alice"));
        console.log("User Name:", getUserName(validUser));
        console.log("Max Number:", findMax(numbers));
        console.log("Factorial of 5:", factorial(5));
        console.log("User Profile Name:", getUserNameFromProfile(validProfile));
        
        // Async example
        void (async () => {
            try {
                const data = await fetchData<User>('https://api.example.com/user');
                console.log("Fetched Data:", data);
            } catch (error) {
                console.error("Fetch Error:", error);
            }
        })();
    } catch (error) {
        console.error("Error in example usage:", error);
    }
}