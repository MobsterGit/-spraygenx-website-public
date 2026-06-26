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
const backToTop=document.createElement('button');
backToTop.className='back-to-top';
backToTop.type='button';
backToTop.setAttribute('aria-label','Back to top');
backToTop.textContent='↑';
document.body.appendChild(backToTop);
const prefersReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function toggleBackToTop(){backToTop.classList.toggle('visible',window.scrollY>360)}
window.addEventListener('scroll',toggleBackToTop,{passive:true});
toggleBackToTop();
backToTop.addEventListener('click',()=>{window.scrollTo({top:0,behavior:prefersReduced?'auto':'smooth'})});
document.querySelectorAll('a[href^="#"]').forEach(a=>{a.addEventListener('click',e=>{const id=a.getAttribute('href');if(id&&id.length>1){const target=document.querySelector(id);if(target){e.preventDefault();target.scrollIntoView({behavior:prefersReduced?'auto':'smooth',block:'start'});}}})});
const emailButton=document.getElementById('emailButton');
const estimateForm=document.getElementById('estimateForm');
const emailAddress='Spray'+'GenX'+'@'+'gmail'+'.com';
if(emailButton){emailButton.addEventListener('click',()=>{window.location.href='mailto:'+emailAddress+'?subject='+encodeURIComponent('Estimate Request')});}
if(estimateForm){estimateForm.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(e.currentTarget);const body=['Name: '+(d.get('name')||''),'Phone: '+(d.get('phone')||''),'Project Address: '+(d.get('address')||''),'Project Type: '+(d.get('type')||''),'','Project Details:',d.get('details')||'','','Photos can be attached to this email.'].join('\n');window.location.href='mailto:'+emailAddress+'?subject='+encodeURIComponent('Spray GenX Estimate Request')+'&body='+encodeURIComponent(body);});}
