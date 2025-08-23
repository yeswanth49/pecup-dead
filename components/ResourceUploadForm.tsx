// components/ResourceUploadForm.tsx
import React, { useState, FormEvent } from 'react';

// --- Simple Input & Button Components (Examples - Use your UI library) ---
// Assuming these components are defined as you provided or imported
const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none ${props.className || ''}`}
  />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none ${props.className || ''}`}
  />
);

const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={`px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 ${props.className || ''}`}
  >
    {props.children}
  </button>
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none appearance-none ${props.className || ''}`}
  >
    {props.children}
  </select>
);
// --- End Simple Components ---


interface Message {
  type: 'success' | 'error';
  text: string;
}

export default function ResourceUploadForm() {
  // --- Existing State ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // --- New State Variables ---
  const [subject, setSubject] = useState('');
  const [unit, setUnit] = useState('');
  const [resourceType, setResourceType] = useState('');
  // --- End New State ---

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
       setMessage(null); // Clear message on new file selection
    } else {
      setFile(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    // --- Updated Validation ---
    if (!file || !title || !category || !subject || !unit || !resourceType) {
      setMessage({
        type: 'error',
        text: 'Please fill in all required fields (*).',
      });
      return;
    }
    // --- End Updated Validation ---

    setIsLoading(true);

    const formData = new FormData();
    // --- Append Existing Fields ---
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('theFile', file); // 'theFile' must match the name expected in the API route

    // --- Append New Fields ---
    formData.append('subject', subject);
    formData.append('unit', unit);
    formData.append('resourceType', resourceType);
    // --- End Append New Fields ---

    try {
      const response = await fetch('/api/uploadResource', {
        method: 'POST',
        body: formData, // FormData handles multipart/form-data encoding
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || `HTTP error! Status: ${response.status}`);
      }

      // Success
      setMessage({
        type: 'success',
        text: `Success! File '${result.fileName}' uploaded. Link: ${result.driveLink}`,
      });

      // --- Optionally clear the form ---
      setTitle('');
      setDescription('');
      setCategory('');
      setSubject(''); // Clear new fields
      setUnit('');    // Clear new fields
      setResourceType(''); // Clear new fields
      setFile(null);
      // Reset file input visually
      const formElement = event.target as HTMLFormElement;
      formElement.reset();
      // --- End Form Clear ---

    } catch (error: any) {
      console.error('Upload failed:', error);
      setMessage({ type: 'error', text: `Upload failed: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* --- Existing Fields --- */}
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-muted-foreground mb-1"
        >
          Resource Name (Title) <span className="text-destructive">*</span>
        </label>
        <Input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-muted-foreground mb-1"
        >
          Description
        </label>
        <Textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div>
        <label
          htmlFor="category"
          className="block text-sm font-medium text-muted-foreground mb-1"
        >
          Category <span className="text-destructive">*</span>
        </label>
        <Select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          disabled={isLoading}
        >
          <option value="" disabled>
            -- Select a Category --
          </option>
          <option value="notes">Notes</option>
          <option value="assignments">Assignments</option>
          <option value="papers">Papers</option>
          <option value="records">Records</option>
           {/* Add more relevant categories if needed */}
        </Select>
      </div>

      {/* --- New Fields Added Below --- */}
      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-muted-foreground mb-1"
        >
          Subject <span className="text-destructive">*</span>
        </label>
        <Input
          type="text"
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          disabled={isLoading}
          placeholder="e.g., Mathematics, Physics, History"
        />
      </div>

      <div>
        <label
          htmlFor="unit"
          className="block text-sm font-medium text-muted-foreground mb-1"
        >
          Unit <span className="text-destructive">*</span>
        </label>
        <Input
          type="number"
          id="unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          required
          min="1"
          max="12"
          disabled={isLoading}
          placeholder="e.g., 1, 2, 3"
        />
      </div>

       <div>
        <label
          htmlFor="resourceType"
          className="block text-sm font-medium text-muted-foreground mb-1"
        >
          Resource Type <span className="text-destructive">*</span>
        </label>
        <Input
          type="text"
          id="resourceType"
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          required
          disabled={isLoading}
          placeholder="e.g., Lecture Notes, Lab Manual, Question Bank"
        />
        {/* Or use a Select dropdown if you have predefined types: */}
        {/* <Select
             id="resourceType"
             value={resourceType}
             onChange={(e) => setResourceType(e.target.value)}
             required
             disabled={isLoading}
           >
             <option value="" disabled>-- Select Resource Type --</option>
             <option value="Notes">Notes</option>
             <option value="Assignment">Assignment</option>
             <option value="Past Paper">Past Paper</option>
             <option value="Textbook Chapter">Textbook Chapter</option>
           </Select> */}
      </div>
      {/* --- End New Fields --- */}

      <div>
        <label
          htmlFor="file"
          className="block text-sm font-medium text-muted-foreground mb-1"
        >
          File <span className="text-destructive">*</span>
        </label>
        <Input
          type="file"
          id="file"
          // Consider if you still want to restrict to PDF only, or allow other types
          // accept=".pdf"
          onChange={handleFileChange}
          required
          disabled={isLoading}
          className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80" // Basic file input styling
        />
        {file && (
          <p className="text-sm text-muted-foreground mt-1">
            Selected: {file.name}
          </p>
        )}
      </div>

      {/* --- Message Area --- */}
      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* --- Submit Button --- */}
      <div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Uploading...' : 'Upload Resource'}
        </Button>
      </div>
    </form>
  );
}