# Dual Subtitles for Stremio

> Learn languages with dual subtitles - display two subtitle languages simultaneously

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

---

## 🎯 Problem

When learning a new language (like French), it's incredibly helpful to watch series and movies with subtitles in **both** your native language (Spanish) and the language you're learning (French) displayed simultaneously. Unfortunately, most existing solutions like Strelingo and MultiSub have functionality or availability issues.

This addon solves that problem by fetching subtitles from OpenSubtitles and merging them into a single dual-language subtitle file that Stremio can display.

---

## ✨ Features

- ✅ **Dual Subtitles**: Display two subtitle languages simultaneously
- ✅ **Multiple Language Pairs**: ES+FR, ES+EN, EN+FR, and more
- ✅ **Automatic Synchronization**: Aligns subtitles by timestamps
- ✅ **Movies & Series Support**: Works with both content types
- ✅ **IMDB Integration**: Uses IMDB IDs for reliable matching
- 🔄 **Phase 2+**: User configuration, offset adjustment, caching (coming soon)

---

## 🚀 Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- OpenSubtitles API key ([Get one here](https://www.opensubtitles.com/en/consumers))

### Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd dual-subtitles-addon
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENSUBTITLES_API_KEY
   ```

4. **Build the project**:
   ```bash
   npm run build
   ```

5. **Start the addon**:
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

---

## 📋 Usage

Once the addon is running:

1. Visit: `http://localhost:7001/manifest.json`
2. Copy the URL
3. Open Stremio
4. Go to Addons → Install addon from URL
5. Paste the URL and install
6. Enjoy dual subtitles when watching content!

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript (strict mode)
- **Framework**: Stremio Addon SDK (official)
- **Server**: Express.js
- **Subtitle Source**: OpenSubtitles API v1

### Key Libraries
- `stremio-addon-sdk`: Core addon framework
- `srt-parser-2`: SRT file parsing and manipulation
- `axios`: HTTP requests to OpenSubtitles API
- `dotenv`: Environment variable management

---

## 📁 Project Structure

```
dual-subtitles-addon/
├── src/
│   ├── addon.ts              # Main addon logic
│   ├── server.ts             # HTTP server entry point
│   ├── config/
│   │   ├── index.ts          # Configuration loader
│   │   └── manifest.ts       # Stremio manifest definition
│   ├── services/
│   │   ├── opensubtitles.ts  # OpenSubtitles API client
│   │   └── subtitleMerger.ts # Subtitle merge algorithm
│   ├── utils/
│   │   ├── srtParser.ts      # SRT parsing utilities
│   │   └── logger.ts         # Logging system
│   └── types/
│       ├── index.ts          # Custom TypeScript types
│       └── stremio-addon-sdk.d.ts  # SDK type definitions
├── dist/                     # Compiled JavaScript (generated)
├── .env.example              # Environment variables template
├── package.json
└── tsconfig.json
```

---

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server with ts-node
npm run dev:launch   # Start dev server and launch Stremio
npm run build        # Compile TypeScript to JavaScript
npm run watch        # Watch mode for TypeScript compiler
npm run lint         # Type-check without emitting files
npm start            # Start production server (requires build first)
```

### Development Status

**✅ Phase 1: Setup and Configuration (COMPLETED)**
- TypeScript project structure
- Core modules and utilities
- SRT parser and merger
- Stremio addon skeleton
- Local testing successful

**🔄 Phase 2: OpenSubtitles API Integration (IN PROGRESS)**
- API client implementation
- Subtitle search and download
- Error handling and rate limits

**⏳ Upcoming Phases**:
- Phase 3: Complete merger implementation
- Phase 4: Full Stremio integration
- Phase 5: User configuration features
- Phase 6: Production deployment
- Phase 7: Documentation and portfolio

---

## 🧪 Testing

To test the addon locally:

```bash
# Start the development server
npm run dev

# In another terminal, test the manifest
curl http://localhost:7001/manifest.json

# Install in Stremio using:
# http://localhost:7001/manifest.json
```

---

## 🤝 Contributing

This is a personal portfolio project, but suggestions and feedback are welcome! Feel free to open an issue or reach out.

---

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🎓 About

This project was created as part of my Computer Engineering degree to demonstrate:

- ✅ Fullstack development skills
- ✅ Problem-solving with real-world applications
- ✅ TypeScript expertise with Node.js
- ✅ External API integration (OpenSubtitles)
- ✅ Professional documentation and code quality

---

## 🔗 Links

- [Stremio Addon SDK Documentation](https://github.com/Stremio/stremio-addon-sdk)
- [OpenSubtitles API Documentation](https://opensubtitles.stoplight.io/)
- [SRT Format Specification](https://en.wikipedia.org/wiki/SubRip)

---

**Made with ❤️ for language learners**
