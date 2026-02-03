# Dual Subtitles for Stremio

> Learn languages with dual subtitles - display two subtitle languages simultaneously

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Phase](https://img.shields.io/badge/Phase-2%2F7%20Complete-success)](https://github.com/blackcat112/dual-subtitles-stremio-addon)

**🚀 Development Status:** Phase 1 (Setup) ✅ | Phase 2 (API Integration) ✅ | Phase 3 (In Progress) 🔄

**Repository:** [github.com/blackcat112/dual-subtitles-stremio-addon](https://github.com/blackcat112/dual-subtitles-stremio-addon)

---

## 🎯 Problem

When learning a new language (like French), it's incredibly helpful to watch series and movies with subtitles in **both** your native language (Spanish) and the language you're learning (French) displayed simultaneously. Unfortunately, most existing solutions like Strelingo and MultiSub have functionality or availability issues.

This addon solves that problem by fetching subtitles from OpenSubtitles and merging them into a single dual-language subtitle file that Stremio can display.

---

> [!IMPORTANT]
> **Demo/Portfolio Project:** This addon uses OpenSubtitles.com free tier API (5 downloads/day limit). It's designed as a **proof of concept** and portfolio piece. For production use with multiple users, a paid API plan would be required.

---

## ✨ Features

- **Dual Language Learning**: Display two subtitle languages simultaneously (e.g., Spanish + French)
- **Automatic Subtitle Fetching**: Retrieves subtitles from OpenSubtitles API
- **Smart Merging**: Combines two SRT files with synchronized timestamps
- **Intelligent Caching**: 24-hour cache reduces API calls and improves performance
- **Support for Movies & Series**: Works with both IMDB movies and TV show episodes
- **Easy Installation**: Simple manifest URL installation in Stremio

## ⚠️ Current Limitations

**OpenSubtitles Free Tier:**
- **5 downloads per day** (resets every 24 hours)
- **2 downloads per content** (one per language)
- **~2-3 different movies/episodes testable per day**

**Cache system mitigates this:**
- First viewing: 2 downloads (ES + FR)
- Repeat viewings (24h): 0 downloads (served from cache)
- Popular content benefits most (multiple users share cache)

**For portfolio demonstrations:** The free tier is sufficient for showcasing functionality to recruiters and peers.

**For production use:** Upgrade to OpenSubtitles paid plan:
- **Light Plan:** $20/month, 2,000 downloads/day (~1,000 contents)
- See: https://www.opensubtitles.com/en/consumers/apikeyable matching
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
- ✅ TypeScript project structure
- ✅ Core modules and utilities
- ✅ SRT parser and merger
- ✅ Stremio addon skeleton
- ✅ Local testing successful

**✅ Phase 2: OpenSubtitles API Integration (COMPLETED)**
- ✅ API client implementation
- ✅ Subtitle search and download
- ✅ Error handling and rate limits
- ✅ In-memory caching system
- ✅ Dual subtitle fetcher
- ✅ Comprehensive testing

**🔄 Phase 3: Stremio Integration (IN PROGRESS)**
- [ ] Complete addon handler implementation
- [ ] HTTP endpoint for merged subtitles
- [ ] Full integration testing in Stremio
- [ ] Subtitle synchronization validation

**⏳ Upcoming Phases**:
- Phase 4: User configuration features
- Phase 5: Production deployment
- Phase 6: Documentation and portfolio

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
