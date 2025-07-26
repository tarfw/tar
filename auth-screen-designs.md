# Auth Screen Designs Documentation

## Overview

This document captures the authentication screen designs and user experience patterns from the "tar" app before the auth system removal. The app used a magic link/code authentication flow powered by InstantDB.

## Authentication Flow

### 1. Magic Link Authentication
The app implemented a two-step authentication process:
1. **Email Step**: User enters their email address
2. **Code Step**: User enters the verification code sent to their email

### 2. User Experience Flow
```
App Launch → Auth Check → Login Screen (if not authenticated)
                      ↓
              Email Input Screen
                      ↓
              Magic Code Sent
                      ↓
              Code Verification Screen
                      ↓
              Main App (Workspace)
```

## Screen Design Details

### Login Screen Layout

#### Header Section
- **App Branding**: Centered layout with icon row and app name
- **Icon Row**: Four colorful icons representing the app's modules:
  - Red ellipse (Ionicons "ellipse")
  - Yellow code square (AntDesign "codesquare") 
  - Blue play button (Ionicons "play")
  - Gray email symbol (MaterialIcons "alternate-email")
- **App Name**: "tar" in large, bold typography
- **Subtitle**: "everything app" in smaller gray text

#### Form Sections

##### Email Step
- **Input Field**: 
  - Placeholder: "Enter your email"
  - Email keyboard type
  - Auto-focus enabled
  - No auto-capitalization or auto-correction
- **Submit Button**: 
  - Text: "Send Code" (changes to "Sending..." when loading)
  - Disabled when email is empty or loading
  - Dark background with white text

##### Code Step
- **Hint Text**: "Code sent to [email]" with email highlighted
- **Input Field**:
  - Placeholder: "123456..."
  - Number pad keyboard
  - 6 character limit
  - Auto-focus enabled
- **Submit Button**:
  - Text: "Verify Code" (changes to "Verifying..." when loading)
  - Disabled when code is empty or loading

## Visual Design System

### Colors
- **Background**: White (#ffffff)
- **Primary Text**: Dark gray (#111827)
- **Secondary Text**: Medium gray (#6B7280)
- **Input Border**: Light gray (#E5E7EB)
- **Placeholder Text**: Gray (#9CA3AF)
- **Button Background**: Dark (#111827)
- **Button Text**: White
- **Disabled Button**: Light gray (#D1D5DB)
- **Icon Colors**: 
  - Red: #ef4444
  - Yellow: #eab308
  - Blue: #1d4ed8
  - Gray: #6b7280

### Typography
- **App Name**: 32px, weight 700, letter-spacing -0.5
- **Subtitle**: 16px, weight 400
- **Input Text**: 16px, weight 400
- **Button Text**: 16px, weight 500
- **Hint Text**: 14px, weight 400
- **Email Highlight**: weight 500

### Layout & Spacing
- **Container**: Full screen with centered content
- **Content Width**: Maximum 400px, centered
- **Horizontal Padding**: 32px
- **Header Margin**: 64px bottom
- **Icon Gap**: 16px between icons
- **Input Padding**: 16px horizontal, 14px vertical
- **Input Margin**: 20px bottom
- **Button Padding**: 14px vertical
- **Border Radius**: 6px for inputs and buttons

### Responsive Design
- **Keyboard Handling**: KeyboardAvoidingView with platform-specific behavior
- **iOS**: 'padding' behavior
- **Android**: 'height' behavior

## Technical Implementation

### State Management
- **Email State**: Tracks entered email address
- **Code State**: Tracks entered verification code
- **Loading State**: Shows loading indicators during API calls
- **Sent Email State**: Controls flow between email and code steps

### Error Handling
- **Magic Code Send Errors**: Alert with error message or fallback
- **Code Verification Errors**: Alert with error message, clears code input
- **Network Errors**: Graceful error messages to user

### Authentication Integration
- **InstantDB Integration**: Used `db.auth.sendMagicCode()` and `db.auth.signInWithMagicCode()`
- **Auth Context**: Provided user state, loading state, and sign out functionality
- **Route Protection**: Automatic redirection based on authentication status

## User Interaction Patterns

### Input Validation
- **Email**: Required, trimmed whitespace
- **Code**: Required, trimmed whitespace, 6 character limit
- **Button States**: Disabled when inputs empty or during loading

### Loading States
- **Visual Feedback**: Button text changes during loading
- **Interaction**: Buttons disabled during API calls
- **Error Recovery**: Loading state reset on error

### Navigation Flow
- **Auto-progression**: Successful email submission moves to code step
- **Error Handling**: Failed attempts reset to appropriate step
- **Deep Linking**: Support for auth-related deep links

## Accessibility Features
- **Auto-focus**: Inputs automatically focused for better UX
- **Keyboard Types**: Appropriate keyboards for email and numeric input
- **Loading Indicators**: Clear feedback during async operations
- **Error Messages**: User-friendly error communication

## Design Principles
1. **Simplicity**: Clean, minimal interface focused on the task
2. **Clarity**: Clear visual hierarchy and intuitive flow
3. **Feedback**: Immediate response to user actions
4. **Accessibility**: Keyboard-friendly and screen reader compatible
5. **Consistency**: Unified design language throughout the flow
