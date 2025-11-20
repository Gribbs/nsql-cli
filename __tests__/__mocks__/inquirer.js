const mockPrompt = jest.fn();

module.exports = {
  prompt: mockPrompt,
  default: {
    prompt: mockPrompt
  },
  createPromptModule: jest.fn(() => mockPrompt)
};

