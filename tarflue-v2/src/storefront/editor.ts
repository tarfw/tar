/**
 * Desktop live-editor shell.
 *
 * Served at {store}.tarai.space/edit. Opens a WebSocket to the store's
 * EditorDO and renders whatever HTML the phone pushes into a full-width
 * iframe. View-only — the owner edits on the phone and watches here.
 */

export function editorShell(slug: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Live Editor — ${slug}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  body{display:flex;flex-direction:column;background:#0b0b0c;color:#e7e7ea}
  .bar{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid #1d1d20;background:#141416;flex:0 0 auto}
  .bar .name{font-weight:600;font-size:14px}
  .bar .slug{color:#8a8a93;font-size:13px}
  .bar .hint{margin-left:auto;color:#8a8a93;font-size:12px}
  .dot{width:8px;height:8px;border-radius:50%;background:#f0a020;transition:background .2s}
  .dot.live{background:#16c060}
  .dot.off{background:#e0443e}
  .stage{flex:1 1 auto;position:relative;background:#fff}
  iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
  .empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;color:#6a6a73;background:#0b0b0c;font-size:15px;padding:24px}
</style></head>
<body>
  <div class="bar">
    <span class="dot" id="dot"></span>
    <span class="name">Live Editor</span>
    <span class="slug">${slug}.tarai.space</span>
    <span class="hint">Edit on your phone — changes appear here instantly</span>
  </div>
  <div class="stage">
    <div class="empty" id="empty">Connecting…</div>
    <iframe id="view" title="Storefront preview" style="display:none"></iframe>
  </div>
<script>
(function(){
  var view = document.getElementById('view');
  var empty = document.getElementById('empty');
  var dot = document.getElementById('dot');
  var ws, ping, backoff = 3000;

  function show(html){
    view.srcdoc = html;
    view.style.display = 'block';
    empty.style.display = 'none';
  }
  function blank(msg){
    view.style.display = 'none';
    empty.style.display = 'flex';
    empty.textContent = msg;
  }

  function connect(){
    var proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(proto + '://' + location.host + '/edit/ws');

    ws.onopen = function(){
      dot.className = 'dot live';
      backoff = 3000;
      clearInterval(ping);
      ping = setInterval(function(){ try{ ws.send('ping'); }catch(e){} }, 25000);
    };
    ws.onmessage = function(ev){
      var msg;
      try{ msg = JSON.parse(ev.data); }catch(e){ return; }
      if(msg.type === 'render'){ show(msg.html); }
      else if(msg.type === 'empty'){ blank('Make your first edit on the phone to see it here.'); }
    };
    ws.onclose = function(){
      dot.className = 'dot off';
      clearInterval(ping);
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 1.5, 15000);
    };
    ws.onerror = function(){ try{ ws.close(); }catch(e){} };
  }
  connect();
})();
</script>
</body></html>`;
}
