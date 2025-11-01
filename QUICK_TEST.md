# Quick Test Guide - Categorizer in Tar App

## ✅ Integration Complete!

Auto-categorization is now active in `productter.tsx`

## 🧪 Test Now

### Step 1: Start the App
```bash
cd C:\tarfwk\tar

# Stop any running expo servers first
# Then start fresh:
npx expo start --clear

# Or if port issue:
npx expo start -p 8082
```

### Step 2: Open App
- Scan QR code with Expo Go app
- Or press 'i' for iOS simulator
- Or press 'a' for Android emulator

### Step 3: Navigate to Productter
1. Tap **Agents** tab (bottom)
2. Tap **Productter** terminal
3. Select any product (or create new one)

### Step 4: Test Auto-Categorization

**Type these in the chat input at bottom:**

```
cafe frappe
```

**Watch the Metro console for:**
```
[ProductAI] No category, auto-categorizing: cafe frappe
[AutoCategorize] Calling: https://taragent-categorizer.tar-54d.workers.dev/api/categorize
[AutoCategorize] Response: {title: "cafe frappe", category: "Beverages"}
[ProductAI] Auto-category assigned: Beverages
```

**In the app UI:**
- Product category should update to "Beverages" automatically

### More Test Cases

Try typing these product names:
```
iphone 15
nike air max
organic green tea
gaming laptop
yoga mat
```

Each should auto-categorize correctly!

## 🎯 What Happens

1. **You type** a product name
2. **AI generates** product details
3. **Auto-categorizer** checks if category is missing
4. **API call** to `https://taragent-categorizer.tar-54d.workers.dev`
5. **Category assigned** automatically (e.g., "Beverages")
6. **Database updated** with the category
7. **UI refreshes** showing the new category

## ✨ Success Indicators

You'll know it works when:
- ✅ Metro console shows `[AutoCategorize]` logs
- ✅ Product category field populates automatically
- ✅ Category makes sense (e.g., "cafe frappe" → "Beverages")
- ✅ No errors in console

## 🔍 Quick Verification

If you can't run the app right now, verify the API directly:

```bash
# PowerShell
$body = '{"title":"cafe frappe"}'
Invoke-WebRequest -Uri "https://taragent-categorizer.tar-54d.workers.dev/api/categorize" -Method POST -ContentType "application/json" -Body $body

# Should return:
# {"title":"cafe frappe","category":"Beverages"}
```

## 🚨 Troubleshooting

**Port 8081 in use:**
```bash
# Find and kill process
netstat -ano | findstr :8081
taskkill /PID <PID> /F

# Or use different port
npx expo start -p 8082
```

**App not connecting:**
- Make sure phone/emulator on same network
- Check firewall settings
- Try `npx expo start --tunnel`

**Categorizer not calling:**
- Check `.env` has: `EXPO_PUBLIC_CATEGORIZER_URL=https://taragent-categorizer.tar-54d.workers.dev`
- Restart expo server after .env changes
- Check Metro console for error logs

## 📱 Mobile Testing Checklist

- [ ] App starts successfully
- [ ] Navigate to Productter terminal
- [ ] Select/create a product
- [ ] Type product name in chat
- [ ] See `[AutoCategorize]` in Metro console
- [ ] Category appears in product UI
- [ ] Category is relevant and correct

## 🎉 You're Done!

Once you see the category auto-populate, the integration is working perfectly! 

The categorizer will now automatically assign categories to all new products created via AI.
