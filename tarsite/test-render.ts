import { compileUIPlan } from './src/planner';
import { compileRouteToHtml } from './src/renderer';

async function runTest() {
  const { plan, error } = await compileUIPlan({
    workspaceId: 'w:milo_test',
    workspaceName: 'Milo Pet Insurance',
    instruction: 'Pet care insurance landing page',
    templateHint: 'milo',
  });

  if (error || !plan) {
    console.error('Plan Error:', error);
    return;
  }

  console.log('Milo Route Nodes Count:', plan.routes[0].nodes.length);
  const html = compileRouteToHtml(plan.routes[0], plan.designTokens);
  console.log('Milo HTML Output Length:', html.length);
}

runTest();
