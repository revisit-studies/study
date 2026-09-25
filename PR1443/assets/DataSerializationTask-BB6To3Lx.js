import{o as e,r as t}from"./rolldown-runtime-C0FnF6B9.js";import{t as n}from"./react-IpA8Qn9U.js";import{A as r,P as i,d as a,i as o,n as s,u as c}from"./polymorphic-factory-ye_P_BX1.js";import{t as l}from"./jsx-runtime-CA2T8_y1.js";import{t as u}from"./create-safe-context-DIwZWr6L.js";import{n as d}from"./use-id-BOzoJ1zE.js";import{r as f}from"./use-merged-ref-DvlzfR5N.js";import{t as p}from"./Radio-DohHX8BR.js";import{t as m}from"./DirectionProvider-B9jme4fZ.js";import{c as h}from"./floating-ui.react-ZeD6aodR.js";import{t as g}from"./to-int-DqgnzVtX.js";import{t as _}from"./Paper-CSXFAWVo.js";import{t as v}from"./Group-fGDfdxev.js";import{t as y}from"./Alert-CU4y9MdG.js";import{t as b}from"./Text-DLoYxBky.js";import{t as x}from"./Badge-BgYXbSbj.js";import{t as S}from"./Button-BDteTP0T.js";import{n as C,t as w}from"./Textarea-Ch14swX-.js";import{t as T}from"./Stack-CRy786cH.js";import{t as E}from"./Title-BGhl_nZb.js";var D=e(n(),1);function O(e){let t=(0,D.useRef)(e);return(0,D.useEffect)(()=>{t.current=e}),(0,D.useMemo)(()=>(...e)=>t.current?.(...e),[])}function k(e,t){let n=typeof t==`number`?t:t.delay,r=typeof t!=`number`&&t.flushOnUnmount,i=O(e),a=(0,D.useRef)(0),o=(0,D.useRef)(()=>{}),s=Object.assign((0,D.useCallback)((...e)=>{window.clearTimeout(a.current);let t=()=>{a.current!==0&&(a.current=0,i(...e))};o.current=t,s.flush=t,a.current=window.setTimeout(t,n)},[i,n]),{flush:o.current});return(0,D.useEffect)(()=>()=>{window.clearTimeout(a.current),r&&s.flush()},[s,r]),s}var A=e(l(),1),[j,M]=u(`ScrollArea.Root component was not found in tree`);function N(e,t){let n=O(t);d(()=>{let t=0;if(e){let r=new ResizeObserver(()=>{cancelAnimationFrame(t),t=window.requestAnimationFrame(n)});return r.observe(e),()=>{window.cancelAnimationFrame(t),r.unobserve(e)}}},[e,n])}var P=(0,D.forwardRef)((e,t)=>{let{style:n,...r}=e,i=M(),[a,o]=(0,D.useState)(0),[s,c]=(0,D.useState)(0),l=!!(a&&s);return N(i.scrollbarX,()=>{let e=i.scrollbarX?.offsetHeight||0;i.onCornerHeightChange(e),c(e)}),N(i.scrollbarY,()=>{let e=i.scrollbarY?.offsetWidth||0;i.onCornerWidthChange(e),o(e)}),l?(0,A.jsx)(`div`,{...r,ref:t,style:{...n,width:a,height:s}}):null}),ee=(0,D.forwardRef)((e,t)=>{let n=M(),r=!!(n.scrollbarX&&n.scrollbarY);return n.type!==`scroll`&&r?(0,A.jsx)(P,{...e,ref:t}):null}),F={scrollHideDelay:1e3,type:`hover`},I=(0,D.forwardRef)((e,t)=>{let{type:n,scrollHideDelay:r,scrollbars:i,...a}=c(`ScrollAreaRoot`,F,e),[s,l]=(0,D.useState)(null),[u,d]=(0,D.useState)(null),[p,m]=(0,D.useState)(null),[h,g]=(0,D.useState)(null),[_,v]=(0,D.useState)(null),[y,b]=(0,D.useState)(0),[x,S]=(0,D.useState)(0),[C,w]=(0,D.useState)(!1),[T,E]=(0,D.useState)(!1),O=f(t,e=>l(e));return(0,A.jsx)(j,{value:{type:n,scrollHideDelay:r,scrollArea:s,viewport:u,onViewportChange:d,content:p,onContentChange:m,scrollbarX:h,onScrollbarXChange:g,scrollbarXEnabled:C,onScrollbarXEnabledChange:w,scrollbarY:_,onScrollbarYChange:v,scrollbarYEnabled:T,onScrollbarYEnabledChange:E,onCornerWidthChange:b,onCornerHeightChange:S},children:(0,A.jsx)(o,{...a,ref:O,__vars:{"--sa-corner-width":i===`xy`?`${y}px`:`0px`,"--sa-corner-height":i===`xy`?`${x}px`:`0px`}})})});I.displayName=`@mantine/core/ScrollAreaRoot`;function L(e,t){let n=e/t;return Number.isNaN(n)?0:n}function R(e){let t=L(e.viewport,e.content),n=e.scrollbar.paddingStart+e.scrollbar.paddingEnd,r=(e.scrollbar.size-n)*t;return Math.max(r,18)}function z(e,t){return n=>{if(e[0]===e[1]||t[0]===t[1])return t[0];let r=(t[1]-t[0])/(e[1]-e[0]);return t[0]+r*(n-e[0])}}function te(e,[t,n]){return Math.min(n,Math.max(t,e))}function ne(e,t,n=`ltr`){let r=R(t),i=t.scrollbar.paddingStart+t.scrollbar.paddingEnd,a=t.scrollbar.size-i,o=t.content-t.viewport,s=a-r,c=te(e,n===`ltr`?[0,o]:[o*-1,0]);return z([0,o],[0,s])(c)}function re(e,t,n,r=`ltr`){let i=R(n),a=i/2,o=t||a,s=i-o,c=n.scrollbar.paddingStart+o,l=n.scrollbar.size-n.scrollbar.paddingEnd-s,u=n.content-n.viewport,d=r===`ltr`?[0,u]:[u*-1,0];return z([c,l],d)(e)}function ie(e,t){return e>0&&e<t}function B(e,t,{checkForDefaultPrevented:n=!0}={}){return r=>{e?.(r),(n===!1||!r.defaultPrevented)&&t?.(r)}}var[ae,V]=u(`ScrollAreaScrollbar was not found in tree`),H=(0,D.forwardRef)((e,t)=>{let{sizes:n,hasThumb:r,onThumbChange:i,onThumbPointerUp:a,onThumbPointerDown:o,onThumbPositionChange:s,onDragScroll:c,onWheelScroll:l,onResize:u,...d}=e,p=M(),[m,h]=(0,D.useState)(null),g=f(t,e=>h(e)),_=(0,D.useRef)(null),v=(0,D.useRef)(``),{viewport:y}=p,b=n.content-n.viewport,x=O(l),S=O(s),C=k(u,10),w=e=>{if(_.current){let t=e.clientX-_.current.left,n=e.clientY-_.current.top;c({x:t,y:n})}};return(0,D.useEffect)(()=>{let e=e=>{let t=e.target;m?.contains(t)&&x(e,b)};return document.addEventListener(`wheel`,e,{passive:!1}),()=>document.removeEventListener(`wheel`,e,{passive:!1})},[y,m,b,x]),(0,D.useEffect)(S,[n,S]),N(m,C),N(p.content,C),(0,A.jsx)(ae,{value:{scrollbar:m,hasThumb:r,onThumbChange:O(i),onThumbPointerUp:O(a),onThumbPositionChange:S,onThumbPointerDown:O(o)},children:(0,A.jsx)(`div`,{...d,ref:g,"data-mantine-scrollbar":!0,style:{position:`absolute`,...d.style},onPointerDown:B(e.onPointerDown,e=>{e.preventDefault(),e.button===0&&(e.target.setPointerCapture(e.pointerId),_.current=m.getBoundingClientRect(),v.current=document.body.style.webkitUserSelect,document.body.style.webkitUserSelect=`none`,w(e))}),onPointerMove:B(e.onPointerMove,w),onPointerUp:B(e.onPointerUp,e=>{let t=e.target;t.hasPointerCapture(e.pointerId)&&(e.preventDefault(),t.releasePointerCapture(e.pointerId))}),onLostPointerCapture:()=>{document.body.style.webkitUserSelect=v.current,_.current=null}})})}),U=(0,D.forwardRef)((e,t)=>{let{sizes:n,onSizesChange:r,style:i,...a}=e,o=M(),[s,c]=(0,D.useState)(),l=(0,D.useRef)(null),u=f(t,l,o.onScrollbarXChange);return(0,D.useEffect)(()=>{l.current&&c(getComputedStyle(l.current))},[l]),(0,A.jsx)(H,{"data-orientation":`horizontal`,...a,ref:u,sizes:n,style:{...i,"--sa-thumb-width":`${R(n)}px`},onThumbPointerDown:t=>e.onThumbPointerDown(t.x),onDragScroll:t=>e.onDragScroll(t.x),onWheelScroll:(t,n)=>{if(o.viewport){let r=o.viewport.scrollLeft+t.deltaX;e.onWheelScroll(r),ie(r,n)&&t.preventDefault()}},onResize:()=>{l.current&&o.viewport&&s&&r({content:o.viewport.scrollWidth,viewport:o.viewport.offsetWidth,scrollbar:{size:l.current.clientWidth,paddingStart:g(s.paddingLeft),paddingEnd:g(s.paddingRight)}})}})});U.displayName=`@mantine/core/ScrollAreaScrollbarX`;var W=(0,D.forwardRef)((e,t)=>{let{sizes:n,onSizesChange:r,style:i,...a}=e,o=M(),[s,c]=(0,D.useState)(),l=(0,D.useRef)(null),u=f(t,l,o.onScrollbarYChange);return(0,D.useEffect)(()=>{l.current&&c(window.getComputedStyle(l.current))},[]),(0,A.jsx)(H,{...a,"data-orientation":`vertical`,ref:u,sizes:n,style:{"--sa-thumb-height":`${R(n)}px`,...i},onThumbPointerDown:t=>e.onThumbPointerDown(t.y),onDragScroll:t=>e.onDragScroll(t.y),onWheelScroll:(t,n)=>{if(o.viewport){let r=o.viewport.scrollTop+t.deltaY;e.onWheelScroll(r),ie(r,n)&&t.preventDefault()}},onResize:()=>{l.current&&o.viewport&&s&&r({content:o.viewport.scrollHeight,viewport:o.viewport.offsetHeight,scrollbar:{size:l.current.clientHeight,paddingStart:g(s.paddingTop),paddingEnd:g(s.paddingBottom)}})}})});W.displayName=`@mantine/core/ScrollAreaScrollbarY`;var G=(0,D.forwardRef)((e,t)=>{let{orientation:n=`vertical`,...r}=e,{dir:i}=m(),a=M(),o=(0,D.useRef)(null),s=(0,D.useRef)(0),[c,l]=(0,D.useState)({content:0,viewport:0,scrollbar:{size:0,paddingStart:0,paddingEnd:0}}),u=L(c.viewport,c.content),d={...r,sizes:c,onSizesChange:l,hasThumb:u>0&&u<1,onThumbChange:e=>{o.current=e},onThumbPointerUp:()=>{s.current=0},onThumbPointerDown:e=>{s.current=e}},f=(e,t)=>re(e,s.current,c,t);return n===`horizontal`?(0,A.jsx)(U,{...d,ref:t,onThumbPositionChange:()=>{if(a.viewport&&o.current){let e=a.viewport.scrollLeft,t=ne(e,c,i);o.current.style.transform=`translate3d(${t}px, 0, 0)`}},onWheelScroll:e=>{a.viewport&&(a.viewport.scrollLeft=e)},onDragScroll:e=>{a.viewport&&(a.viewport.scrollLeft=f(e,i))}}):n===`vertical`?(0,A.jsx)(W,{...d,ref:t,onThumbPositionChange:()=>{if(a.viewport&&o.current){let e=a.viewport.scrollTop,t=ne(e,c);c.scrollbar.size===0?o.current.style.setProperty(`--thumb-opacity`,`0`):o.current.style.setProperty(`--thumb-opacity`,`1`),o.current.style.transform=`translate3d(0, ${t}px, 0)`}},onWheelScroll:e=>{a.viewport&&(a.viewport.scrollTop=e)},onDragScroll:e=>{a.viewport&&(a.viewport.scrollTop=f(e))}}):null});G.displayName=`@mantine/core/ScrollAreaScrollbarVisible`;var K=(0,D.forwardRef)((e,t)=>{let n=M(),{forceMount:r,...i}=e,[a,o]=(0,D.useState)(!1),s=e.orientation===`horizontal`,c=k(()=>{if(n.viewport){let e=n.viewport.offsetWidth<n.viewport.scrollWidth,t=n.viewport.offsetHeight<n.viewport.scrollHeight;o(s?e:t)}},10);return N(n.viewport,c),N(n.content,c),r||a?(0,A.jsx)(G,{"data-state":a?`visible`:`hidden`,...i,ref:t}):null});K.displayName=`@mantine/core/ScrollAreaScrollbarAuto`;var q=(0,D.forwardRef)((e,t)=>{let{forceMount:n,...r}=e,i=M(),[a,o]=(0,D.useState)(!1);return(0,D.useEffect)(()=>{let{scrollArea:e}=i,t=0;if(e){let n=()=>{window.clearTimeout(t),o(!0)},r=()=>{t=window.setTimeout(()=>o(!1),i.scrollHideDelay)};return e.addEventListener(`pointerenter`,n),e.addEventListener(`pointerleave`,r),()=>{window.clearTimeout(t),e.removeEventListener(`pointerenter`,n),e.removeEventListener(`pointerleave`,r)}}},[i.scrollArea,i.scrollHideDelay]),n||a?(0,A.jsx)(K,{"data-state":a?`visible`:`hidden`,...r,ref:t}):null});q.displayName=`@mantine/core/ScrollAreaScrollbarHover`;var oe=(0,D.forwardRef)((e,t)=>{let{forceMount:n,...r}=e,i=M(),a=e.orientation===`horizontal`,[o,s]=(0,D.useState)(`hidden`),c=k(()=>s(`idle`),100);return(0,D.useEffect)(()=>{if(o===`idle`){let e=window.setTimeout(()=>s(`hidden`),i.scrollHideDelay);return()=>window.clearTimeout(e)}},[o,i.scrollHideDelay]),(0,D.useEffect)(()=>{let{viewport:e}=i,t=a?`scrollLeft`:`scrollTop`;if(e){let n=e[t],r=()=>{let r=e[t];n!==r&&(s(`scrolling`),c()),n=r};return e.addEventListener(`scroll`,r),()=>e.removeEventListener(`scroll`,r)}},[i.viewport,a,c]),n||o!==`hidden`?(0,A.jsx)(G,{"data-state":o===`hidden`?`hidden`:`visible`,...r,ref:t,onPointerEnter:B(e.onPointerEnter,()=>s(`interacting`)),onPointerLeave:B(e.onPointerLeave,()=>s(`idle`))}):null}),J=(0,D.forwardRef)((e,t)=>{let{forceMount:n,...r}=e,i=M(),{onScrollbarXEnabledChange:a,onScrollbarYEnabledChange:o}=i,s=e.orientation===`horizontal`;return(0,D.useEffect)(()=>(s?a(!0):o(!0),()=>{s?a(!1):o(!1)}),[s,a,o]),i.type===`hover`?(0,A.jsx)(q,{...r,ref:t,forceMount:n}):i.type===`scroll`?(0,A.jsx)(oe,{...r,ref:t,forceMount:n}):i.type===`auto`?(0,A.jsx)(K,{...r,ref:t,forceMount:n}):i.type===`always`?(0,A.jsx)(G,{...r,ref:t}):null});J.displayName=`@mantine/core/ScrollAreaScrollbar`;function se(e,t=()=>{}){let n={left:e.scrollLeft,top:e.scrollTop},r=0;return(function i(){let a={left:e.scrollLeft,top:e.scrollTop},o=n.left!==a.left,s=n.top!==a.top;(o||s)&&t(),n=a,r=window.requestAnimationFrame(i)})(),()=>window.cancelAnimationFrame(r)}var Y=(0,D.forwardRef)((e,t)=>{let{style:n,...r}=e,i=M(),a=V(),{onThumbPositionChange:o}=a,s=f(t,e=>a.onThumbChange(e)),c=(0,D.useRef)(void 0),l=k(()=>{c.current&&=(c.current(),void 0)},100);return(0,D.useEffect)(()=>{let{viewport:e}=i;if(e){let t=()=>{if(l(),!c.current){let t=se(e,o);c.current=t,o()}};return o(),e.addEventListener(`scroll`,t),()=>e.removeEventListener(`scroll`,t)}},[i.viewport,l,o]),(0,A.jsx)(`div`,{"data-state":a.hasThumb?`visible`:`hidden`,...r,ref:s,style:{width:`var(--sa-thumb-width)`,height:`var(--sa-thumb-height)`,...n},onPointerDownCapture:B(e.onPointerDownCapture,e=>{let t=e.target.getBoundingClientRect(),n=e.clientX-t.left,r=e.clientY-t.top;a.onThumbPointerDown({x:n,y:r})}),onPointerUp:B(e.onPointerUp,a.onThumbPointerUp)})});Y.displayName=`@mantine/core/ScrollAreaThumb`;var X=(0,D.forwardRef)((e,t)=>{let{forceMount:n,...r}=e,i=V();return n||i.hasThumb?(0,A.jsx)(Y,{ref:t,...r}):null});X.displayName=`@mantine/core/ScrollAreaThumb`;var ce=(0,D.forwardRef)(({children:e,style:t,...n},r)=>{let i=M(),a=f(r,i.onViewportChange);return(0,A.jsx)(o,{...n,ref:a,style:{overflowX:i.scrollbarXEnabled?`scroll`:`hidden`,overflowY:i.scrollbarYEnabled?`scroll`:`hidden`,...t},children:(0,A.jsx)(`div`,{style:{minWidth:`100%`},ref:i.onContentChange,children:e})})});ce.displayName=`@mantine/core/ScrollAreaViewport`;var Z={root:`m_d57069b5`,viewport:`m_c0783ff9`,viewportInner:`m_f8f631dd`,scrollbar:`m_c44ba933`,thumb:`m_d8b5e363`,corner:`m_21657268`},le={scrollHideDelay:1e3,type:`hover`,scrollbars:`xy`},ue=r((e,{scrollbarSize:t,overscrollBehavior:n})=>({root:{"--scrollarea-scrollbar-size":i(t),"--scrollarea-over-scroll-behavior":n}})),Q=s((e,t)=>{let n=c(`ScrollArea`,le,e),{classNames:r,className:i,style:o,styles:s,unstyled:l,scrollbarSize:u,vars:d,type:f,scrollHideDelay:p,viewportProps:m,viewportRef:g,onScrollPositionChange:_,children:v,offsetScrollbars:y,scrollbars:b,onBottomReached:x,onTopReached:S,overscrollBehavior:C,...w}=n,[T,E]=(0,D.useState)(!1),[O,k]=(0,D.useState)(!1),[j,M]=(0,D.useState)(!1),N=a({name:`ScrollArea`,props:n,classes:Z,className:i,style:o,classNames:r,styles:s,unstyled:l,vars:d,varsResolver:ue}),P=(0,D.useRef)(null),F=h([g,P]);return(0,D.useEffect)(()=>{if(!P.current||y!==`present`)return;let e=P.current,t=new ResizeObserver(()=>{let{scrollHeight:t,clientHeight:n,scrollWidth:r,clientWidth:i}=e;k(t>n),M(r>i)});return t.observe(e),()=>t.disconnect()},[P,y]),(0,A.jsxs)(I,{type:f===`never`?`always`:f,scrollHideDelay:p,ref:t,scrollbars:b,...N(`root`),...w,children:[(0,A.jsx)(ce,{...m,...N(`viewport`,{style:m?.style}),ref:F,"data-offset-scrollbars":y===!0?`xy`:y||void 0,"data-scrollbars":b||void 0,"data-horizontal-hidden":y===`present`&&!j?`true`:void 0,"data-vertical-hidden":y===`present`&&!O?`true`:void 0,onScroll:e=>{m?.onScroll?.(e),_?.({x:e.currentTarget.scrollLeft,y:e.currentTarget.scrollTop});let{scrollTop:t,scrollHeight:n,clientHeight:r}=e.currentTarget;t-(n-r)>=-.6&&x?.(),t===0&&S?.()},children:v}),(b===`xy`||b===`x`)&&(0,A.jsx)(J,{...N(`scrollbar`),orientation:`horizontal`,"data-hidden":f===`never`||y===`present`&&!j||void 0,forceMount:!0,onMouseEnter:()=>E(!0),onMouseLeave:()=>E(!1),children:(0,A.jsx)(X,{...N(`thumb`)})}),(b===`xy`||b===`y`)&&(0,A.jsx)(J,{...N(`scrollbar`),orientation:`vertical`,"data-hidden":f===`never`||y===`present`&&!O||void 0,forceMount:!0,onMouseEnter:()=>E(!0),onMouseLeave:()=>E(!1),children:(0,A.jsx)(X,{...N(`thumb`)})}),(0,A.jsx)(ee,{...N(`corner`),"data-hovered":T||void 0,"data-hidden":f===`never`||void 0})]})});Q.displayName=`@mantine/core/ScrollArea`;var $=s((e,t)=>{let{children:n,classNames:r,styles:i,scrollbarSize:a,scrollHideDelay:s,type:l,dir:u,offsetScrollbars:d,viewportRef:f,onScrollPositionChange:p,unstyled:m,variant:h,viewportProps:g,scrollbars:_,style:v,vars:y,onBottomReached:b,onTopReached:x,...S}=c(`ScrollAreaAutosize`,le,e);return(0,A.jsx)(o,{...S,ref:t,style:[{display:`flex`,overflow:`auto`},v],children:(0,A.jsx)(o,{style:{display:`flex`,flexDirection:`column`,flex:1},children:(0,A.jsx)(Q,{classNames:r,styles:i,scrollHideDelay:s,scrollbarSize:a,type:l,dir:u,offsetScrollbars:d,viewportRef:f,onScrollPositionChange:p,unstyled:m,variant:h,viewportProps:g,vars:y,scrollbars:_,onBottomReached:b,onTopReached:x,children:n})})})});Q.classes=Z,$.displayName=`@mantine/core/ScrollAreaAutosize`,$.classes=Z,Q.Autosize=$;var de=t({default:()=>ve}),fe={JSON:`{
  "name": "d3",
  "version": "7.9.0",
  "engines": { "node": ">=18" },
  "keywords": ["visualization", "data"],
  "repository": { "type": "git", "url": "https://github.com/d3/d3" },
  "dependencies": { "d3-array": "^3.2.4", "d3-scale": "^4.0.2" }
}`,JSONC:`// Visualization package configuration
{
  "name": "d3",
  "version": "7.9.0",
  "engines": { "node": ">=18" },
  "keywords": ["visualization", "data"],
  "repository": { "type": "git", "url": "https://github.com/d3/d3" },
  "dependencies": { "d3-array": "^3.2.4", "d3-scale": "^4.0.2" },
}`,JSON5:`// Visualization package configuration
{
  name: 'd3',
  version: '7.9.0',
  engines: { node: '>=18' },
  keywords: ['visualization', 'data'],
  repository: { type: 'git', url: 'https://github.com/d3/d3' },
  dependencies: { 'd3-array': '^3.2.4', 'd3-scale': '^4.0.2' },
}`,HJSON:`# Visualization package configuration
name: d3
version: 7.9.0
engines: { node: >=18 }
keywords: [visualization, data]
repository: { type: git, url: https://github.com/d3/d3 }
dependencies: { d3-array: ^3.2.4, d3-scale: ^4.0.2 }`,YAML:`# Visualization package configuration
name: d3
version: 7.9.0
engines:
  node: ">=18"
keywords:
  - visualization
  - data
repository:
  type: git
  url: https://github.com/d3/d3
dependencies:
  d3-array: ^3.2.4
  d3-scale: ^4.0.2`,TOML:`# Visualization package configuration
name = "d3"
version = "7.9.0"
keywords = ["visualization", "data"]

[engines]
node = ">=18"

[repository]
type = "git"
url = "https://github.com/d3/d3"

[dependencies]
d3-array = "^3.2.4"
d3-scale = "^4.0.2"`,XML:`<?xml version="1.0"?>
<package>
  <name>d3</name>
  <version>7.9.0</version>
  <engines><node>&gt;=18</node></engines>
  <keywords><keyword>visualization</keyword><keyword>data</keyword></keywords>
  <repository type="git"><url>https://github.com/d3/d3</url></repository>
  <dependencies><dependency name="d3-array">^3.2.4</dependency><dependency name="d3-scale">^4.0.2</dependency></dependencies>
</package>`},pe={JSON:`[
  { "student": "Alice", "quiz1": 88, "quiz2": 95, "final": 92, "sports": ["tennis"], "absences": 0 },
  { "student": "Bob", "quiz1": 76, "quiz2": 82, "final": 91, "sports": ["soccer", "track"], "absences": 1 },
  { "student": "Carla", "quiz1": 90, "quiz2": 87, "final": 89, "sports": ["swimming"], "absences": 0 }
]`,JSONC:`// Student assessment records
[
  { "student": "Alice", "quiz1": 88, "quiz2": 95, "final": 92, "sports": ["tennis"], "absences": 0 },
  { "student": "Bob", "quiz1": 76, "quiz2": 82, "final": 91, "sports": ["soccer", "track"], "absences": 1 },
  { "student": "Carla", "quiz1": 90, "quiz2": 87, "final": 89, "sports": ["swimming"], "absences": 0 },
]`,JSON5:`// Student assessment records
[
  { student: 'Alice', quiz1: 88, quiz2: 95, final: 92, sports: ['tennis'], absences: 0 },
  { student: 'Bob', quiz1: 76, quiz2: 82, final: 91, sports: ['soccer', 'track'], absences: 1 },
  { student: 'Carla', quiz1: 90, quiz2: 87, final: 89, sports: ['swimming'], absences: 0 },
]`,HJSON:`# Student assessment records
[
  { student: Alice, quiz1: 88, quiz2: 95, final: 92, sports: [tennis], absences: 0 }
  { student: Bob, quiz1: 76, quiz2: 82, final: 91, sports: [soccer, track], absences: 1 }
  { student: Carla, quiz1: 90, quiz2: 87, final: 89, sports: [swimming], absences: 0 }
]`,YAML:`# Student assessment records
- student: Alice
  quiz1: 88
  quiz2: 95
  final: 92
  sports: [tennis]
  absences: 0
- student: Bob
  quiz1: 76
  quiz2: 82
  final: 91
  sports: [soccer, track]
  absences: 1
- student: Carla
  quiz1: 90
  quiz2: 87
  final: 89
  sports: [swimming]
  absences: 0`,TOML:`# Student assessment records
[[students]]
student = "Alice"
quiz1 = 88
quiz2 = 95
final = 92
sports = ["tennis"]
absences = 0

[[students]]
student = "Bob"
quiz1 = 76
quiz2 = 82
final = 91
sports = ["soccer", "track"]
absences = 1

[[students]]
student = "Carla"
quiz1 = 90
quiz2 = 87
final = 89
sports = ["swimming"]
absences = 0`,XML:`<?xml version="1.0"?>
<students>
  <student name="Alice"><quiz1>88</quiz1><quiz2>95</quiz2><final>92</final><sports><sport>tennis</sport></sports><absences>0</absences></student>
  <student name="Bob"><quiz1>76</quiz1><quiz2>82</quiz2><final>91</final><sports><sport>soccer</sport><sport>track</sport></sports><absences>1</absences></student>
  <student name="Carla"><quiz1>90</quiz1><quiz2>87</quiz2><final>89</final><sports><sport>swimming</sport></sports><absences>0</absences></student>
</students>`},me={config:[{id:`version`,prompt:`What is the value of the version field?`,options:[`7.9.0`,`7.9`,`>=18`,`^4.0.2`]},{id:`node`,prompt:`What Node version does this package require?`,options:[`>=18`,`7.9.0`,`^3.2.4`,`No version is specified`]},{id:`keywords`,prompt:`How many values does the keywords field contain?`,options:[`One`,`Two`,`Three`,`Four`]}],tabular:[{id:`bobFinal`,prompt:`What is Bob’s final-exam grade?`,options:[`82`,`89`,`91`,`95`]},{id:`aliceQuiz`,prompt:`On which quiz did Alice receive her higher grade?`,options:[`Quiz 1`,`Quiz 2`,`They are equal`,`Neither quiz`]},{id:`twoSports`,prompt:`Which student participates in two sports?`,options:[`Alice`,`Bob`,`Carla`,`No student`]},{id:`noAbsences`,prompt:`Which students have zero absences?`,options:[`Alice and Bob`,`Bob and Carla`,`Alice and Carla`,`All students`]}]};function he(e,t,n){let r=e===`config`?`software configuration`:`student-record table`;return t===`reading`?[`Inspect this `,r,` expressed in `,n,`, then answer each question.`].join(``):t===`authoring`?[`Create the requested `,r,` data in `,n,`. The target structure is shown in JSON as a format-neutral reference.`].join(``):[`Edit the `,r,` data expressed in `,n,`. Record the complete revised document in the editor.`].join(``)}function ge(e){return e===`config`?`{
  "name": "sample-viz-plugin",
  "version": "1.0.0",
  "enabled": true,
  "themes": ["light", "dark"],
  "repository": { "type": "git", "url": "https://example.org/plugin" }
}`:`[
  { "student": "Dion", "quiz1": 84, "quiz2": 90, "final": 88, "sports": ["basketball"], "absences": 0 },
  { "student": "Eve", "quiz1": 93, "quiz2": 91, "final": 94, "sports": ["volleyball", "track"], "absences": 2 }
]`}function _e(e){return e===`config`?[`Change the package version to 8.0.0.`,`Add "d3-shape": "^3.2.0" under dependencies.`,`Remove the repository URL while retaining its type.`,`Add "accessibility" to the keywords list.`]:[`Add 5 points to every final-exam grade.`,`Add "chess" to every student’s sports list.`,`Remove quiz1 from every student record.`,`Add a passing field: true when the revised final grade is at least 90, otherwise false.`]}function ve({parameters:e,setAnswer:t}){let n=e.dataContext===`config`?fe[e.format]:pe[e.format],[r,i]=(0,D.useState)({}),[a,o]=(0,D.useState)(e.taskType===`modifying`?n:``),[s,c]=(0,D.useState)(!1),l=(0,D.useMemo)(()=>Date.now(),[]),u=me[e.dataContext],d=e.taskType===`reading`?u.every(({id:e})=>r[e]):a.trim().length>0;return(0,A.jsxs)(T,{gap:`md`,maw:1080,mx:`auto`,children:[(0,A.jsxs)(v,{gap:`xs`,children:[(0,A.jsx)(x,{color:e.dataContext===`config`?`violet`:`cyan`,children:e.dataContext.toUpperCase()}),(0,A.jsx)(x,{variant:`light`,children:e.format}),(0,A.jsx)(x,{variant:`outline`,children:e.taskType})]}),(0,A.jsx)(y,{color:`gray`,title:`Task`,children:he(e.dataContext,e.taskType,e.format)}),e.taskType===`authoring`&&(0,A.jsxs)(_,{withBorder:!0,p:`md`,children:[(0,A.jsx)(E,{order:4,mb:`xs`,children:`Target structure`}),(0,A.jsx)(C,{block:!0,children:ge(e.dataContext)})]}),(0,A.jsxs)(_,{withBorder:!0,p:`md`,children:[(0,A.jsx)(E,{order:4,mb:`xs`,children:e.taskType===`authoring`?`Starting point`:`Data`}),e.taskType===`authoring`?(0,A.jsx)(b,{c:`dimmed`,children:`Use the target structure above to write a new document in the assigned format.`}):(0,A.jsx)(Q,{h:300,type:`auto`,children:(0,A.jsx)(C,{block:!0,children:n})})]}),e.taskType===`reading`?(0,A.jsx)(T,{gap:`lg`,children:u.map(e=>(0,A.jsx)(p.Group,{label:e.prompt,value:r[e.id]||``,onChange:t=>i(n=>({...n,[e.id]:t})),withAsterisk:!0,children:(0,A.jsx)(T,{gap:`xs`,mt:`xs`,children:e.options.map(e=>(0,A.jsx)(p,{value:e,label:e,disabled:s},e))})},e.id))}):(0,A.jsxs)(A.Fragment,{children:[e.taskType===`modifying`&&(0,A.jsx)(y,{color:`orange`,title:`Required changes`,children:(0,A.jsx)(`ol`,{children:_e(e.dataContext).map(e=>(0,A.jsx)(`li`,{children:e},e))})}),(0,A.jsx)(w,{"aria-label":[e.format,e.taskType,`editor`].join(` `),autosize:!0,minRows:14,label:[e.format,`document`].join(` `),value:a,onChange:e=>o(e.currentTarget.value),disabled:s,styles:{input:{fontFamily:`monospace`,fontSize:14}}})]}),(0,A.jsx)(S,{onClick:()=>{c(!0);let n={taskId:e.taskId,dataContext:e.dataContext,format:e.format,taskType:e.taskType,elapsedSeconds:Math.round((Date.now()-l)/1e3)};t({status:!0,answers:e.taskType===`reading`?{...n,responses:r}:{...n,document:a}})},disabled:s||!d,children:s?`Task recorded`:`Record task response`})]})}export{Q as n,O as r,de as t};