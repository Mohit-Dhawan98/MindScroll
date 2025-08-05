# 🤝 Contributing to MindScroll

Thank you for your interest in contributing to MindScroll! We welcome contributions from developers of all skill levels.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Basic knowledge of React/Next.js and Node.js

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/mindscroll.git
   cd mindscroll
   ```

2. **Backend setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your API keys
   npx prisma migrate dev
   npm start
   ```

3. **Frontend setup**
   ```bash
   cd ../frontend
   npm install
   cp .env.local.example .env.local
   npm run dev
   ```

## 📋 How to Contribute

### 🐛 Reporting Bugs
- Check existing issues first
- Use the bug report template
- Include reproduction steps
- Add relevant screenshots

### 💡 Suggesting Features
- Check the [roadmap](FUTURE_ROADMAP.md) first
- Use the feature request template
- Explain the use case clearly
- Consider implementation complexity

### 🔧 Code Contributions

#### 1. Choose an Issue
- Look for issues labeled `good first issue` or `help wanted`
- Comment on the issue to indicate you're working on it
- Wait for maintainer approval before starting

#### 2. Development Workflow
```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# Write tests if applicable
# Follow code style guidelines

# Commit with descriptive messages
git commit -m "feat: add user content upload functionality"

# Push and create PR
git push origin feature/your-feature-name
```

#### 3. Pull Request Guidelines
- **Title**: Use conventional commits format (`feat:`, `fix:`, `docs:`, etc.)
- **Description**: Explain what changes were made and why
- **Testing**: Describe how you tested your changes
- **Screenshots**: Include screenshots for UI changes

## 🎯 Development Guidelines

### Code Style
- **Frontend**: Follow React/Next.js best practices
- **Backend**: Use Express.js conventions
- **Database**: Follow Prisma schema patterns
- **TypeScript**: Use proper typing throughout

### File Structure
```
backend/
├── src/
│   ├── controllers/    # API endpoint handlers
│   ├── routes/        # Express routes
│   ├── processors/    # AI content processing
│   ├── middleware/    # Auth & error handling
│   └── utils/         # Helper functions

frontend/
├── src/
│   ├── app/           # Next.js app router pages
│   ├── components/    # React components
│   ├── lib/           # API client & utilities
│   └── stores/        # Zustand state management
```

### Naming Conventions
- **Files**: kebab-case (`user-profile.tsx`)
- **Components**: PascalCase (`UserProfile`)
- **Functions**: camelCase (`getUserProfile`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### Git Commit Messages
Follow [Conventional Commits](https://conventionalcommits.org/):
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance tasks

## 🧪 Testing

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Writing Tests
- Write unit tests for utility functions
- Write integration tests for API endpoints
- Write component tests for React components
- Include tests in your PRs when applicable

## 📝 Documentation

### Code Documentation
- Add JSDoc comments for complex functions
- Keep README files updated
- Document API endpoints
- Explain complex algorithms

### Architecture Decisions
- Document major architectural decisions
- Update technical documentation
- Keep roadmap current

## 🎯 Areas for Contribution

### High Priority
- 🔧 **Bug fixes**: Fix existing issues
- 📚 **Documentation**: Improve guides and docs
- 🧪 **Testing**: Add test coverage
- ♿ **Accessibility**: Improve a11y compliance

### Medium Priority
- 🎨 **UI/UX**: Enhance user experience
- ⚡ **Performance**: Optimize loading times
- 🔒 **Security**: Improve security measures
- 📱 **Mobile**: Enhance mobile experience

### Future Features (V0.2+)
- 📄 **Content Upload**: User content processing
- 🤖 **AI Tutor**: Enhanced AI interactions
- 🔗 **Integrations**: Third-party service integrations
- 📊 **Analytics**: Advanced learning analytics

## 🌟 Recognition

Contributors will be:
- Added to the contributors list
- Mentioned in release notes
- Invited to the contributors Discord
- Eligible for contributor badges

## 💬 Community

### Getting Help
- 💬 **Discord**: Join our contributor Discord
- 🐛 **Issues**: Ask questions in GitHub issues
- 📧 **Email**: Contact maintainers directly
- 📚 **Docs**: Check our documentation

### Code of Conduct
- Be respectful and inclusive
- Help others learn and grow
- Provide constructive feedback
- Follow GitHub community guidelines

## 🏆 Becoming a Maintainer

Active contributors may be invited to become maintainers. Maintainers:
- Review and merge pull requests
- Triage issues and bugs
- Guide project direction
- Mentor new contributors

## 🎉 Thank You!

Every contribution makes MindScroll better for learners worldwide. Whether you fix a typo, add a feature, or report a bug - you're helping build the future of personalized learning.

---

**Ready to contribute?** Check out our [good first issues](https://github.com/your-username/mindscroll/labels/good%20first%20issue) and start making an impact! 🚀