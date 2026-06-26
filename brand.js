document.querySelectorAll('[data-year]').forEach(el=>{el.textContent=new Date().getFullYear()});
if(!document.querySelector('link[href="mobile-polish.css"]')){const polish=document.createElement('link');polish.rel='stylesheet';polish.href='mobile-polish.css';document.head.appendChild(polish);}
const menuButton=document.getElementById('mobileMenuButton');
const mobilePanel=document.getElementById('mobilePanel');
if(menuButton&&mobilePanel){
  menuButton.addEventListener('click',()=>{
    const isOpen=mobilePanel.classList.toggle('open');
    menuButton.setAttribute('aria-expanded',isOpen?'true':'false');
    menuButton.textContent=isOpen?'×':'☰';
  });
  mobilePanel.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
    mobilePanel.classList.remove('open');
    menuButton.setAttribute('aria-expanded','false');
    menuButton.textContent='☰';
  }));
}
const emailButton=document.getElementById('emailButton');
const estimateForm=document.getElementById('estimateForm');
const emailAddress='Spray'+'GenX'+'@'+'gmail'+'.com';
if(emailButton){emailButton.addEventListener('click',()=>{window.location.href='mailto:'+emailAddress+'?subject='+encodeURIComponent('Estimate Request')});}
if(estimateForm){estimateForm.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(e.currentTarget);const body=['Name: '+(d.get('name')||''),'Phone: '+(d.get('phone')||''),'Project Address: '+(d.get('address')||''),'Project Type: '+(d.get('type')||''),'','Project Details:',d.get('details')||'','','Photos can be attached to this email.'].join('\n');window.location.href='mailto:'+emailAddress+'?subject='+encodeURIComponent('Spray GenX Estimate Request')+'&body='+encodeURIComponent(body);});}
