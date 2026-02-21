
import { stripBreadcrumbs, htmlToContent, contentToHtml } from './utils/breadcrumbs.ts';

const mockId = '123';
const mockLabel = 'Test Label';
const mockText = 'Highlighted Text';

// 1. Simulate content creation via htmlToContent (Editor save)
// HTML in editor: <span data-breadcrumb-id="123" data-label="Test Label">Highlighted Text</span>
// We need to mock DOMParser for htmlToContent if it uses it.
// Since we can't easily mock DOMParser in this node environment without jsdom,
// I will rely on inspecting the code logic and testing the REGEX against likely strings.

const storedContent = `
Normal text before.
<!-- bc:start:123:Test Label -->Highlighted Text<!-- bc:end:123 -->
Normal text after.
`;

const storedContentEscaped = `
Normal text before.
&lt;!-- bc:start:123:Test Label --&gt;Highlighted Text&lt;!-- bc:end:123 --&gt;
Normal text after.
`;

const storedContentMixed = `
Normal text before.
<!-- bc:start:123:Test Label -->Highlighted Text<!-- bc:end:123 -->
&lt;!-- bc:start:456:Escaped Label --&gt;Other Text&lt;!-- bc:end:456 --&gt;
Normal text after.
`;

console.log("--- Test 1: Standard Stored Content ---");
console.log(stripBreadcrumbs(storedContent));

console.log("\n--- Test 2: Escaped Content (Potential Issue) ---");
console.log(stripBreadcrumbs(storedContentEscaped));

console.log("\n--- Test 3: Mixed Content ---");
console.log(stripBreadcrumbs(storedContentMixed));
