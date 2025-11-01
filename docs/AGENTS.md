# Agent Instructions for TAR Repository

## Build/Lint/Test Commands
- **Start dev server**: `npm start` or `npx expo start`
- **Android**: `npm run android` or `npx expo start --android`
- **iOS**: `npm run ios` or `npx expo start --ios`
- **Web**: `npm run web` or `npx expo start --web`
- **Lint**: `npm run lint` or `npx expo lint`
- **No test runner configured** - add Jest if needed for testing

## Architecture Overview
- **Main app**: Expo React Native app with file-based routing (expo-router)
- **Database**: InstantDB for real-time data with comprehensive e-commerce schema (stores, products, orders, customers, inventory, payments)
- **Subproject**: Cloudflare Worker (`cloudflare-worker/`) for chat API using AI SDK
- **Auth**: InstantDB magic code authentication
- **TypeScript**: Strict mode with path mapping `@/*` → `./*`

## Code Style Guidelines
- **Imports**: Single quotes, named imports from `react-native`
- **Functions**: CamelCase, arrow functions preferred
- **Styling**: `StyleSheet.create()` with inline style objects
- **Types**: Full TypeScript with interfaces for complex objects
- **Error handling**: Try/catch with user-friendly error messages
- **InstantDB**: Index fields for filtering/sorting, use `db.useQuery()` for reads, `db.transact()` for writes
