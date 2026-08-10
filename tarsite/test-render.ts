import { compileUIPlan } from './src/planner';
import { renderUIPlanToHtml } from './src/renderer';

async function runTest() {
  const { plan, error } = await compileUIPlan({
    workspaceId: 'w:teststore',
    workspaceName: 'Aesthetic Coffee Roasters',
    instruction: 'Warm paper canvas coffee roasters with artisanal espresso beans',
    templateHint: 'notion',
    products: [
      { name: 'Single Origin Ethiopia Yirgacheffe', price: 480, description: 'Floral notes of jasmine and bergamot.' },
      { name: 'Signature House Blend Roast', price: 380, description: 'Rich dark chocolate and toasted hazelnut finish.' },
      { name: 'Reserve Cold Brew Concentrate', price: 290, description: 'Steeped for 18 hours in mountain spring water.' },
    ],
  });

  if (error || !plan) {
    console.error('Plan Error:', error);
    return;
  }

  const html = renderUIPlanToHtml(plan, '/');
  console.log('HTML Output Length:', html.length);
  console.log('Sample HTML Head & Tokens:\n', html.slice(0, 1500));
}

runTest();
