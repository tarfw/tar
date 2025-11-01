# Test Categorizer in Tar App

## 🧪 Testing Steps

### Method 1: Test via AI Product Generation

1. **Open the tar app**
   ```bash
   cd C:\tarfwk\tar
   npm start
   # or
   npx expo start
   ```

2. **Navigate to Products**
   - Open the app on your device/emulator
   - Go to the **Agents** tab
   - Select **Productter** terminal
   - Select any product (or create a new one)

3. **Test Auto-Categorization**
   - Type a product name in the chat input at the bottom
   - Example messages to try:
     ```
     cafe frappe
     iphone 15
     nike running shoes
     organic green tea
     gaming laptop
     ```

4. **Watch the Console**
   - You'll see logs like:
     ```
     [ProductAI] No category, auto-categorizing: cafe frappe
     [AutoCategorize] Calling: https://taragent-categorizer.tar-54d.workers.dev/api/categorize for: cafe frappe
     [AutoCategorize] Response: {title: "cafe frappe", category: "Beverages"}
     [ProductAI] Auto-category assigned: Beverages
     ```

5. **Verify in UI**
   - The product's category should update automatically
   - Check the product details view
   - Category should show: "Beverages" (or whatever was returned)

### Method 2: Direct API Test in App

Add a test button in productter.tsx (temporary):

```typescript
// Add this near the top of the component
const testCategorizer = async () => {
  const testProducts = ['cafe frappe', 'iphone 15', 'nike shoes'];
  console.log('[Test] Starting categorization test...');
  
  for (const product of testProducts) {
    const category = await autoCategorize(product);
    console.log(`[Test] ${product} → ${category}`);
  }
};

// Call it on component mount (temporary test)
useEffect(() => {
  testCategorizer();
}, []);
```

### Method 3: Test via Browser (Quick Check)

If the app isn't starting, test directly:

1. Open browser to: `https://taragent-categorizer.tar-54d.workers.dev/api/health`
   - Should see: `{"status":"ok"}`

2. Test with curl/Postman:
   ```bash
   curl -X POST https://taragent-categorizer.tar-54d.workers.dev/api/categorize \
     -H "Content-Type: application/json" \
     -d '{"title":"cafe frappe"}'
   ```

## 📱 Expected Behavior

### Before Auto-Categorization
```typescript
Product: {
  title: "cafe frappe",
  category: null,  // or empty
  status: "active"
}
```

### After Auto-Categorization
```typescript
Product: {
  title: "cafe frappe",
  category: "Beverages",  // ✅ Auto-assigned!
  status: "active"
}
```

## 🎯 Real Usage Scenarios

### Scenario 1: Create New Product
1. Open Productter terminal
2. Type: "create cafe frappe"
3. AI generates product structure
4. **Auto-categorizer runs automatically**
5. Category is assigned: "Beverages"

### Scenario 2: Update Existing Product
1. Select a product without a category
2. Type: "add category"
3. AI processes
4. **Auto-categorizer suggests category**
5. Category is updated

### Scenario 3: Bulk Import
1. Import CSV with product names
2. For each product without category:
3. **Auto-categorizer runs**
4. All products get categorized

## 🔍 Debugging

### Check Logs
Look for these in Metro/Expo console:
```
[AutoCategorize] Calling: https://taragent-categorizer...
[AutoCategorize] Response: {...}
[ProductAI] Auto-category assigned: ...
```

### Common Issues

**Issue: "Cannot find variable: generateAPIUrl"**
- Solution: The function exists in `utils.ts`, should work automatically

**Issue: Network request failed**
- Check internet connection
- Verify worker URL is correct
- Test worker directly: https://taragent-categorizer.tar-54d.workers.dev/api/health

**Issue: Category not showing in UI**
- Check if `onProductChange` is called
- Verify database update transaction completed
- Refresh the product list

## 📊 Performance Monitoring

Watch the console for:
- ✅ Request time: Should be 200-500ms
- ✅ Success rate: Should be near 100%
- ✅ Category quality: Should be relevant

## ✨ Success Indicators

You'll know it's working when:
1. ✅ Console shows `[AutoCategorize]` logs
2. ✅ API responds in <1 second
3. ✅ Category appears in product view
4. ✅ Category makes sense for the product
5. ✅ No error messages

## 🎉 Test Examples

Try these products and expected categories:

| Product Title | Expected Category |
|---------------|-------------------|
| cafe frappe | Beverages / Coffee |
| iphone 15 pro | Electronics |
| nike air max | Footwear / Shoes |
| green tea | Beverages |
| macbook pro | Electronics |
| denim jacket | Apparel / Clothing |
| yoga mat | Sports & Fitness |
| office chair | Furniture |
| shampoo | Beauty & Personal Care |
| toy car | Toys & Games |

## 🚀 Next Steps After Testing

1. ✅ Confirm auto-categorization works
2. ✅ Remove test console.logs (optional)
3. ✅ Use in production product creation
4. ✅ Monitor accuracy and adjust prompts if needed
