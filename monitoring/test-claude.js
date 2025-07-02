const axios = require('axios');

// Use environment variable for security - never hardcode API keys!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'your-api-key-here';

async function testClaudeAPI() {
    console.log('🧠 Testing Anthropic Claude API connection...');
    
    if (ANTHROPIC_API_KEY === 'your-api-key-here') {
        console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set!');
        console.log('💡 Please set your API key:');
        console.log('   Windows: set ANTHROPIC_API_KEY=your-key-here');
        console.log('   Linux/Mac: export ANTHROPIC_API_KEY=your-key-here');
        console.log('   Or create a .env file with: ANTHROPIC_API_KEY=your-key-here');
        return false;
    }
    
    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 100,
            messages: [{
                role: 'user',
                content: 'Respond with exactly: "API connection successful! Ready for bot monitoring."'
            }]
        }, {
            headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Claude API Response:', response.data.content[0].text);
        console.log('🎯 API connection verified - Ready to start monitoring!');
        return true;

    } catch (error) {
        console.error('❌ Claude API Error:', error.response?.data || error.message);
        console.log('🔧 Check your API key and quota.');
        return false;
    }
}

// Run the test
testClaudeAPI(); 