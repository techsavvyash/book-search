// Simple script to create a basic PDF for testing
// This creates a minimal PDF that can be used for API testing

const fs = require('fs');

// Simple PDF content (minimal valid PDF structure)
const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 87
>>
stream
BT
/F1 12 Tf
100 700 Td
(The Little Fish and the Big Ocean) Tj
100 680 Td
(A sample story for testing) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000089 00000 n 
0000000249 00000 n 
0000000389 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
459
%%EOF`;

// Write the PDF to test-files directory
fs.writeFileSync('./test-files/sample-story.pdf', pdfContent);
console.log('✅ Created test-files/sample-story.pdf');

console.log('\n📋 Test files created:');
console.log('- test-files/sample-story.txt');
console.log('- test-files/sample-story.pdf');
console.log('\n🔧 You can now test the API with:');
console.log('curl -X POST http://localhost:3000/analyze \\');
console.log('  -F "textFile=@./test-files/sample-story.txt" \\');
console.log('  -F "pdfFile=@./test-files/sample-story.pdf"'); 