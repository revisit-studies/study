import{o as e,r as t}from"./rolldown-runtime-C0FnF6B9.js";import{t as n}from"./react-C21x__mS.js";import{P as r,R as i,d as a,f as o,r as s,t as c}from"./Box-0RIX65xt.js";import{t as l}from"./create-safe-context-DyY1EXuR.js";import{n as u}from"./use-id-DNOlRwW-.js";import{n as d,t as f}from"./to-int-BUxqyWcn.js";import{r as p}from"./use-merged-ref-DALjXO0h.js";import{t as m}from"./Radio-CXFFFdbS.js";import{t as h}from"./jsx-runtime-BdxMnOeJ.js";import{t as g}from"./DirectionProvider-BP370mPs.js";import{l as _}from"./floating-ui.react-DllRWkub.js";import{t as v}from"./Paper-nnSy8De3.js";import{t as y}from"./Group-DbIwBtux.js";import{t as b}from"./Alert-DwXgLxjM.js";import{t as x}from"./Text-C4jbrasd.js";import{t as S}from"./Badge-BYbJNBvN.js";import{t as C}from"./Button-CKhhVd2s.js";import{n as w,t as T}from"./Textarea-nbiCqgIc.js";import{t as E}from"./Stack-BnsUqPQ7.js";import{t as D}from"./Title-Dnq_Hgzk.js";var O=e(n(),1);function k(e,t){let{delay:n,flushOnUnmount:r,leading:i,maxWait:a}=typeof t==`number`?{delay:t,flushOnUnmount:!1,leading:!1,maxWait:void 0}:t,o=d(e),s=(0,O.useRef)(0),c=(0,O.useRef)(0),l=(0,O.useRef)(null),u=(0,O.useMemo)(()=>{let e=Object.assign((...t)=>{window.clearTimeout(s.current),l.current=t;let r=e._isFirstCall;e._isFirstCall=!1;function u(){window.clearTimeout(s.current),window.clearTimeout(c.current),s.current=0,c.current=0,e._isFirstCall=!0,e._hasPendingCallback=!1}function d(){a!==void 0&&c.current===0&&(c.current=window.setTimeout(()=>{if(s.current!==0){let e=l.current;u(),o(...e)}},a))}if(i&&r){o(...t),e.flush=()=>{s.current!==0&&(u(),o(...t))},e.cancel=()=>{u()},s.current=window.setTimeout(()=>{u()},n),d();return}if(i&&!r){e._hasPendingCallback=!0,e.flush=()=>{s.current!==0&&(u(),o(...t))},e.cancel=()=>{u()},s.current=window.setTimeout(()=>{u()},n),d();return}e._hasPendingCallback=!0;let f=()=>{s.current!==0&&(u(),o(...t))};e.flush=f,e.cancel=()=>{u()},s.current=window.setTimeout(f,n),d()},{flush:()=>{},cancel:()=>{},isPending:()=>e._hasPendingCallback,_isFirstCall:!0,_hasPendingCallback:!1});return e},[o,n,i,a]);return(0,O.useEffect)(()=>()=>{r?u.flush():u.cancel()},[u,r]),u}var[ee,A]=l(`ScrollArea.Root component was not found in tree`);function j(e,t){let n=(0,O.useEffectEvent)(t);u(()=>{let t=0;if(e){let r=new ResizeObserver(()=>{cancelAnimationFrame(t),t=window.requestAnimationFrame(n)});return r.observe(e),()=>{window.cancelAnimationFrame(t),r.unobserve(e)}}},[e])}var M=e(h(),1);function N(e){let{style:t,...n}=e,r=A(),[i,a]=(0,O.useState)(0),[o,s]=(0,O.useState)(0),c=!!(i&&o);return j(r.scrollbarX,()=>{let e=r.scrollbarX?.offsetHeight||0;r.onCornerHeightChange(e),s(e)}),j(r.scrollbarY,()=>{let e=r.scrollbarY?.offsetWidth||0;r.onCornerWidthChange(e),a(e)}),c?(0,M.jsx)(`div`,{...n,style:{...t,width:i,height:o}}):null}function P(e){let t=A(),n=!!(t.scrollbarX&&t.scrollbarY);return t.type!==`scroll`&&n?(0,M.jsx)(N,{...e}):null}var F={scrollHideDelay:1e3,type:`hover`};function te(e){let{type:t,scrollHideDelay:n,scrollbars:r,getStyles:i,ref:a,...s}=o(`ScrollAreaRoot`,F,e),[l,u]=(0,O.useState)(null),[d,f]=(0,O.useState)(null),[m,h]=(0,O.useState)(null),[g,_]=(0,O.useState)(null),[v,y]=(0,O.useState)(null),[b,x]=(0,O.useState)(0),[S,C]=(0,O.useState)(0),[w,T]=(0,O.useState)(!1),[E,D]=(0,O.useState)(!1),k=p(a,u);return(0,M.jsx)(ee,{value:{type:t,scrollHideDelay:n,scrollArea:l,viewport:d,onViewportChange:f,content:m,onContentChange:h,scrollbarX:g,onScrollbarXChange:_,scrollbarXEnabled:w,onScrollbarXEnabledChange:T,scrollbarY:v,onScrollbarYChange:y,scrollbarYEnabled:E,onScrollbarYEnabledChange:D,onCornerWidthChange:x,onCornerHeightChange:C,getStyles:i},children:(0,M.jsx)(c,{...s,ref:k,__vars:{"--sa-corner-width":r===`xy`?`${b}px`:`0px`,"--sa-corner-height":r===`xy`?`${S}px`:`0px`}})})}te.displayName=`@mantine/core/ScrollAreaRoot`;function I(e,t){let n=e/t;return Number.isNaN(n)?0:n}function L(e){let t=I(e.viewport,e.content),n=e.scrollbar.paddingStart+e.scrollbar.paddingEnd,r=(e.scrollbar.size-n)*t;return Math.max(r,18)}function R(e,t){return n=>{if(e[0]===e[1]||t[0]===t[1])return t[0];let r=(t[1]-t[0])/(e[1]-e[0]);return t[0]+r*(n-e[0])}}function z(e,[t,n]){return Math.min(n,Math.max(t,e))}function B(e,t,n=`ltr`){let r=L(t),i=t.scrollbar.paddingStart+t.scrollbar.paddingEnd,a=t.scrollbar.size-i,o=t.content-t.viewport,s=a-r,c=z(e,n===`ltr`?[0,o]:[o*-1,0]);return R([0,o],[0,s])(c)}function V(e,t,n,r=`ltr`){let i=L(n),a=i/2,o=t||a,s=i-o,c=n.scrollbar.paddingStart+o,l=n.scrollbar.size-n.scrollbar.paddingEnd-s,u=n.content-n.viewport,d=r===`ltr`?[0,u]:[u*-1,0];return R([c,l],d)(e)}function H(e,t){return e>0&&e<t}function U(e,t,{checkForDefaultPrevented:n=!0}={}){return r=>{e?.(r),(n===!1||!r.defaultPrevented)&&t?.(r)}}var[W,G]=l(`ScrollAreaScrollbar was not found in tree`);function K(e){let{sizes:t,hasThumb:n,onThumbChange:r,onThumbPointerUp:i,onThumbPointerDown:a,onThumbPositionChange:o,onDragScroll:s,onWheelScroll:c,onResize:l,ref:u,...f}=e,m=A(),[h,g]=(0,O.useState)(null),_=p(u,g),v=(0,O.useRef)(null),y=(0,O.useRef)(``),{viewport:b}=m,x=t.content-t.viewport,S=(0,O.useEffectEvent)(c),C=d(o),w=k(l,10),T=e=>{if(v.current){let t=e.clientX-v.current.left,n=e.clientY-v.current.top;s({x:t,y:n})}};return(0,O.useEffect)(()=>{let e=e=>{let t=e.target;h?.contains(t)&&S(e,x)};return document.addEventListener(`wheel`,e,{passive:!1}),()=>document.removeEventListener(`wheel`,e,{passive:!1})},[b,h,x]),(0,O.useEffect)(C,[t,C]),j(h,w),j(m.content,w),(0,M.jsx)(W,{value:{scrollbar:h,hasThumb:n,onThumbChange:d(r),onThumbPointerUp:d(i),onThumbPositionChange:C,onThumbPointerDown:d(a)},children:(0,M.jsx)(`div`,{...f,ref:_,"data-mantine-scrollbar":!0,style:{position:`absolute`,...f.style},onPointerDown:U(e.onPointerDown,e=>{e.preventDefault(),e.button===0&&(e.target.setPointerCapture(e.pointerId),v.current=h.getBoundingClientRect(),y.current=document.body.style.webkitUserSelect,document.body.style.webkitUserSelect=`none`,T(e))}),onPointerMove:U(e.onPointerMove,T),onPointerUp:U(e.onPointerUp,e=>{let t=e.target;t.hasPointerCapture(e.pointerId)&&(e.preventDefault(),t.releasePointerCapture(e.pointerId))}),onLostPointerCapture:()=>{document.body.style.webkitUserSelect=y.current,v.current=null}})})}var q=e=>{let{sizes:t,onSizesChange:n,style:r,ref:i,...a}=e,o=A(),[s,c]=(0,O.useState)(),l=(0,O.useRef)(null),u=p(i,l,o.onScrollbarXChange);return(0,O.useEffect)(()=>{l.current&&c(getComputedStyle(l.current))},[l]),(0,M.jsx)(K,{"data-orientation":`horizontal`,...a,ref:u,sizes:t,style:{...r,"--sa-thumb-width":`${L(t)}px`},onThumbPointerDown:t=>e.onThumbPointerDown(t.x),onDragScroll:t=>e.onDragScroll(t.x),onWheelScroll:(t,n)=>{if(o.viewport){let r=o.viewport.scrollLeft+t.deltaX;e.onWheelScroll(r),H(r,n)&&t.preventDefault()}},onResize:()=>{l.current&&o.viewport&&s&&n({content:o.viewport.scrollWidth,viewport:o.viewport.offsetWidth,scrollbar:{size:l.current.clientWidth,paddingStart:f(s.paddingLeft),paddingEnd:f(s.paddingRight)}})}})};q.displayName=`@mantine/core/ScrollAreaScrollbarX`;function ne(e){let{sizes:t,onSizesChange:n,style:r,ref:i,...a}=e,o=A(),[s,c]=(0,O.useState)(),l=(0,O.useRef)(null),u=p(i,l,o.onScrollbarYChange);return(0,O.useEffect)(()=>{l.current&&c(window.getComputedStyle(l.current))},[]),(0,M.jsx)(K,{...a,"data-orientation":`vertical`,ref:u,sizes:t,style:{"--sa-thumb-height":`${L(t)}px`,...r},onThumbPointerDown:t=>e.onThumbPointerDown(t.y),onDragScroll:t=>e.onDragScroll(t.y),onWheelScroll:(t,n)=>{if(o.viewport){let r=o.viewport.scrollTop+t.deltaY;e.onWheelScroll(r),H(r,n)&&t.preventDefault()}},onResize:()=>{l.current&&o.viewport&&s&&n({content:o.viewport.scrollHeight,viewport:o.viewport.offsetHeight,scrollbar:{size:l.current.clientHeight,paddingStart:f(s.paddingTop),paddingEnd:f(s.paddingBottom)}})}})}ne.displayName=`@mantine/core/ScrollAreaScrollbarY`;function J(e){let{orientation:t=`vertical`,...n}=e,{dir:r}=g(),i=A(),a=(0,O.useRef)(null),o=(0,O.useRef)(0),[s,c]=(0,O.useState)({content:0,viewport:0,scrollbar:{size:0,paddingStart:0,paddingEnd:0}}),l=I(s.viewport,s.content),u={...n,sizes:s,onSizesChange:c,hasThumb:l>0&&l<1,onThumbChange:e=>{a.current=e},onThumbPointerUp:()=>{o.current=0},onThumbPointerDown:e=>{o.current=e}},d=(e,t)=>V(e,o.current,s,t);return t===`horizontal`?(0,M.jsx)(q,{...u,onThumbPositionChange:()=>{if(i.viewport&&a.current){let e=i.viewport.scrollLeft,t=B(e,s,r);a.current.style.transform=`translate3d(${t}px, 0, 0)`}},onWheelScroll:e=>{i.viewport&&(i.viewport.scrollLeft=e)},onDragScroll:e=>{i.viewport&&(i.viewport.scrollLeft=d(e,r))}}):t===`vertical`?(0,M.jsx)(ne,{...u,onThumbPositionChange:()=>{if(i.viewport&&a.current){let e=i.viewport.scrollTop,t=B(e,s);s.scrollbar.size===0?a.current.style.setProperty(`--thumb-opacity`,`0`):a.current.style.setProperty(`--thumb-opacity`,`1`),a.current.style.transform=`translate3d(0, ${t}px, 0)`}},onWheelScroll:e=>{i.viewport&&(i.viewport.scrollTop=e)},onDragScroll:e=>{i.viewport&&(i.viewport.scrollTop=d(e))}}):null}J.displayName=`@mantine/core/ScrollAreaScrollbarVisible`;function Y(e){let t=A(),{forceMount:n,...r}=e,[i,a]=(0,O.useState)(!1),o=e.orientation===`horizontal`,s=k(()=>{if(t.viewport){let e=t.viewport.offsetWidth<t.viewport.scrollWidth,n=t.viewport.offsetHeight<t.viewport.scrollHeight;a(o?e:n)}},10);return j(t.viewport,s),j(t.content,s),n||i?(0,M.jsx)(J,{"data-state":i?`visible`:`hidden`,...r}):null}Y.displayName=`@mantine/core/ScrollAreaScrollbarAuto`;function re(e){let{forceMount:t,...n}=e,r=A(),[i,a]=(0,O.useState)(!1);return(0,O.useEffect)(()=>{let{scrollArea:e}=r,t=0;if(e){let n=()=>{window.clearTimeout(t),a(!0)},i=()=>{t=window.setTimeout(()=>a(!1),r.scrollHideDelay)};return e.addEventListener(`pointerenter`,n),e.addEventListener(`pointerleave`,i),()=>{window.clearTimeout(t),e.removeEventListener(`pointerenter`,n),e.removeEventListener(`pointerleave`,i)}}},[r.scrollArea,r.scrollHideDelay]),t||i?(0,M.jsx)(Y,{"data-state":i?`visible`:`hidden`,...n}):null}re.displayName=`@mantine/core/ScrollAreaScrollbarHover`;function ie(e){let{forceMount:t,...n}=e,r=A(),i=e.orientation===`horizontal`,[a,o]=(0,O.useState)(`hidden`),s=k(()=>o(`idle`),100);return(0,O.useEffect)(()=>{if(a===`idle`){let e=window.setTimeout(()=>o(`hidden`),r.scrollHideDelay);return()=>window.clearTimeout(e)}},[a,r.scrollHideDelay]),(0,O.useEffect)(()=>{let{viewport:e}=r,t=i?`scrollLeft`:`scrollTop`;if(e){let n=e[t],r=()=>{let r=e[t];n!==r&&(o(`scrolling`),s()),n=r};return e.addEventListener(`scroll`,r),()=>e.removeEventListener(`scroll`,r)}},[r.viewport,i,s]),t||a!==`hidden`?(0,M.jsx)(J,{"data-state":a===`hidden`?`hidden`:`visible`,...n,onPointerEnter:U(e.onPointerEnter,()=>o(`interacting`)),onPointerLeave:U(e.onPointerLeave,()=>o(`idle`))}):null}function X(e){let{forceMount:t,...n}=e,r=A(),{onScrollbarXEnabledChange:i,onScrollbarYEnabledChange:a}=r,o=e.orientation===`horizontal`;return(0,O.useEffect)(()=>(o?i(!0):a(!0),()=>{o?i(!1):a(!1)}),[o,i,a]),r.type===`hover`?(0,M.jsx)(re,{...n,forceMount:t}):r.type===`scroll`?(0,M.jsx)(ie,{...n,forceMount:t}):r.type===`auto`?(0,M.jsx)(Y,{...n,forceMount:t}):r.type===`always`?(0,M.jsx)(J,{...n}):null}X.displayName=`@mantine/core/ScrollAreaScrollbar`;function ae(e,t=()=>{}){let n={left:e.scrollLeft,top:e.scrollTop},r=0;return(function i(){let a={left:e.scrollLeft,top:e.scrollTop},o=n.left!==a.left,s=n.top!==a.top;(o||s)&&t(),n=a,r=window.requestAnimationFrame(i)})(),()=>window.cancelAnimationFrame(r)}function oe(e){let{style:t,ref:n,...r}=e,i=A(),a=G(),{onThumbPositionChange:o}=a,s=p(n,a.onThumbChange),c=(0,O.useRef)(void 0),l=k(()=>{c.current&&=(c.current(),void 0)},100);return(0,O.useEffect)(()=>{let{viewport:e}=i;if(e){let t=()=>{if(l(),!c.current){let t=ae(e,o);c.current=t,o()}};return o(),e.addEventListener(`scroll`,t),()=>e.removeEventListener(`scroll`,t)}},[i.viewport,l,o]),(0,M.jsx)(`div`,{"data-state":a.hasThumb?`visible`:`hidden`,...r,ref:s,style:{width:`var(--sa-thumb-width)`,height:`var(--sa-thumb-height)`,...t},onPointerDownCapture:U(e.onPointerDownCapture,e=>{let t=e.target.getBoundingClientRect(),n=e.clientX-t.left,r=e.clientY-t.top;a.onThumbPointerDown({x:n,y:r})}),onPointerUp:U(e.onPointerUp,a.onThumbPointerUp)})}oe.displayName=`@mantine/core/ScrollAreaThumb`;function Z(e){let{forceMount:t,...n}=e,r=G();return t||r.hasThumb?(0,M.jsx)(oe,{...n}):null}Z.displayName=`@mantine/core/ScrollAreaThumb`;function se({children:e,style:t,ref:n,onWheel:r,...i}){let a=A(),o=p(n,a.onViewportChange),s=e=>{if(r?.(e),a.scrollbarXEnabled&&a.viewport&&e.shiftKey){let{scrollTop:t,scrollHeight:n,clientHeight:r,scrollWidth:i,clientWidth:o}=a.viewport,s=t<1,c=t>=n-r-1;i>o&&(s||c)&&e.stopPropagation()}};return(0,M.jsx)(c,{...i,ref:o,onWheel:s,"data-scrollarea-viewport":!0,style:{overflowX:a.scrollbarXEnabled?`scroll`:`hidden`,overflowY:a.scrollbarYEnabled?`scroll`:`hidden`,...t},children:(0,M.jsx)(`div`,{...a.getStyles(`content`),ref:a.onContentChange,children:e})})}se.displayName=`@mantine/core/ScrollAreaViewport`;var Q={root:`m_d57069b5`,content:`m_b1336c6`,viewport:`m_c0783ff9`,viewportInner:`m_f8f631dd`,scrollbar:`m_c44ba933`,thumb:`m_d8b5e363`,corner:`m_21657268`},ce={scrollHideDelay:1e3,type:`hover`,scrollbars:`xy`},le=r((e,{scrollbarSize:t,overscrollBehavior:n,scrollbars:r})=>{let a=n;return n&&r&&(r===`x`?a=`${n} auto`:r===`y`&&(a=`auto ${n}`)),{root:{"--scrollarea-scrollbar-size":i(t),"--scrollarea-over-scroll-behavior":a}}}),$=s(e=>{let t=o(`ScrollArea`,ce,e),{classNames:n,className:r,style:i,styles:s,unstyled:c,scrollbarSize:l,vars:d,type:f,scrollHideDelay:p,viewportProps:m,viewportRef:h,onScrollPositionChange:g,children:v,offsetScrollbars:y,scrollbars:b,onBottomReached:x,onTopReached:S,onLeftReached:C,onRightReached:w,overscrollBehavior:T,startScrollPosition:E,verticalScrollbarPosition:D,attributes:k,...ee}=t,[A,N]=(0,O.useState)(!1),[F,I]=(0,O.useState)(!1),[L,R]=(0,O.useState)(!1),z=(0,O.useRef)(!0),B=(0,O.useRef)(!1),V=(0,O.useRef)(!0),H=(0,O.useRef)(!1),U=a({name:`ScrollArea`,props:t,classes:Q,className:r,style:i,classNames:n,styles:s,unstyled:c,attributes:k,vars:d,varsResolver:le}),W=(0,O.useRef)(null),[G,K]=(0,O.useState)(null),q=_([h,W,(0,O.useCallback)(e=>{K(t=>t===e?t:e)},[])]);return j(y===`present`?G:null,()=>{let e=W.current;e&&(I(e.scrollHeight>e.clientHeight),R(e.scrollWidth>e.clientWidth))}),u(()=>{E&&W.current&&W.current.scrollTo({left:E.x??0,top:E.y??0})},[]),(0,M.jsxs)(te,{getStyles:U,type:f===`never`?`always`:f,scrollHideDelay:p,scrollbars:b,...U(`root`),...ee,children:[(0,M.jsx)(se,{...m,...U(`viewport`,{style:m?.style}),ref:q,"data-offset-scrollbars":y===!0?`xy`:y||void 0,"data-scrollbars":b||void 0,"data-vertical-scrollbar-position":D||void 0,"data-horizontal-hidden":y===`present`&&!L?`true`:void 0,"data-vertical-hidden":y===`present`&&!F?`true`:void 0,onScroll:e=>{m?.onScroll?.(e),g?.({x:e.currentTarget.scrollLeft,y:e.currentTarget.scrollTop});let{scrollTop:t,scrollHeight:n,clientHeight:r,scrollLeft:i,scrollWidth:a,clientWidth:o}=e.currentTarget,s=t-(n-r)>=-.8,c=t===0;s&&!B.current&&x?.(),c&&!z.current&&S?.(),B.current=s,z.current=c;let l=i-(a-o)>=-.8,u=i===0;l&&!H.current&&w?.(),u&&!V.current&&C?.(),H.current=l,V.current=u},children:v}),(b===`xy`||b===`x`)&&(0,M.jsx)(X,{...U(`scrollbar`),orientation:`horizontal`,"data-vertical-scrollbar-position":D||void 0,"data-hidden":f===`never`||y===`present`&&!L||void 0,forceMount:!0,onMouseEnter:()=>N(!0),onMouseLeave:()=>N(!1),children:(0,M.jsx)(Z,{...U(`thumb`)})}),(b===`xy`||b===`y`)&&(0,M.jsx)(X,{...U(`scrollbar`),orientation:`vertical`,"data-vertical-scrollbar-position":D||void 0,"data-hidden":f===`never`||y===`present`&&!F||void 0,forceMount:!0,onMouseEnter:()=>N(!0),onMouseLeave:()=>N(!1),children:(0,M.jsx)(Z,{...U(`thumb`)})}),(0,M.jsx)(P,{...U(`corner`),"data-vertical-scrollbar-position":D||void 0,"data-hovered":A||void 0,"data-hidden":f===`never`||void 0})]})});$.displayName=`@mantine/core/ScrollArea`;var ue=s(e=>{let{children:t,classNames:n,styles:r,scrollbarSize:i,scrollHideDelay:a,type:s,dir:l,offsetScrollbars:u,overscrollBehavior:d,viewportRef:f,onScrollPositionChange:p,unstyled:m,variant:h,viewportProps:g,scrollbars:v,style:y,vars:b,onBottomReached:x,onTopReached:S,startScrollPosition:C,verticalScrollbarPosition:w,onOverflowChange:T,...E}=o(`ScrollAreaAutosize`,ce,e),D=(0,O.useRef)(null),[k,ee]=(0,O.useState)(null),A=_([f,D,(0,O.useCallback)(e=>{ee(t=>t===e?t:e)},[])]),N=(0,O.useRef)(!1),P=(0,O.useRef)(!1),F=(0,O.useEffectEvent)(()=>{let e=D.current;if(!e||!T)return;let t=e.scrollHeight>e.clientHeight;t!==N.current&&(P.current?T(t):(P.current=!0,t&&T(!0)),N.current=t)});return j(T?k:null,F),(0,M.jsx)(c,{...E,variant:h,style:[{display:`flex`,overflow:`hidden`},y],children:(0,M.jsx)(c,{style:{display:`flex`,flexDirection:`column`,flex:1,overflow:`hidden`,...v===`y`&&{minWidth:0},...v===`x`&&{minHeight:0},...v===`xy`&&{minWidth:0,minHeight:0},...v===!1&&{minWidth:0,minHeight:0}},children:(0,M.jsx)($,{classNames:n,styles:r,scrollHideDelay:a,scrollbarSize:i,type:s,dir:l,offsetScrollbars:u,overscrollBehavior:d,viewportRef:A,onScrollPositionChange:p,unstyled:m,variant:h,viewportProps:g,vars:b,scrollbars:v,onBottomReached:x,onTopReached:S,startScrollPosition:C,verticalScrollbarPosition:w,"data-autosize":`true`,children:t})})})});$.classes=Q,$.varsResolver=le,ue.displayName=`@mantine/core/ScrollAreaAutosize`,ue.classes=Q,$.Autosize=ue;var de=t({default:()=>ve}),fe={JSON:`{
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
]`}function _e(e){return e===`config`?[`Change the package version to 8.0.0.`,`Add "d3-shape": "^3.2.0" under dependencies.`,`Remove the repository URL while retaining its type.`,`Add "accessibility" to the keywords list.`]:[`Add 5 points to every final-exam grade.`,`Add "chess" to every student’s sports list.`,`Remove quiz1 from every student record.`,`Add a passing field: true when the revised final grade is at least 90, otherwise false.`]}function ve({parameters:e,setAnswer:t}){let n=e.dataContext===`config`?fe[e.format]:pe[e.format],[r,i]=(0,O.useState)({}),[a,o]=(0,O.useState)(e.taskType===`modifying`?n:``),[s,c]=(0,O.useState)(!1),l=(0,O.useMemo)(()=>Date.now(),[]),u=me[e.dataContext],d=e.taskType===`reading`?u.every(({id:e})=>r[e]):a.trim().length>0;return(0,M.jsxs)(E,{gap:`md`,maw:1080,mx:`auto`,children:[(0,M.jsxs)(y,{gap:`xs`,children:[(0,M.jsx)(S,{color:e.dataContext===`config`?`violet`:`cyan`,children:e.dataContext.toUpperCase()}),(0,M.jsx)(S,{variant:`light`,children:e.format}),(0,M.jsx)(S,{variant:`outline`,children:e.taskType})]}),(0,M.jsx)(b,{color:`gray`,title:`Task`,children:he(e.dataContext,e.taskType,e.format)}),e.taskType===`authoring`&&(0,M.jsxs)(v,{withBorder:!0,p:`md`,children:[(0,M.jsx)(D,{order:4,mb:`xs`,children:`Target structure`}),(0,M.jsx)(w,{block:!0,children:ge(e.dataContext)})]}),(0,M.jsxs)(v,{withBorder:!0,p:`md`,children:[(0,M.jsx)(D,{order:4,mb:`xs`,children:e.taskType===`authoring`?`Starting point`:`Data`}),e.taskType===`authoring`?(0,M.jsx)(x,{c:`dimmed`,children:`Use the target structure above to write a new document in the assigned format.`}):(0,M.jsx)($,{h:300,type:`auto`,children:(0,M.jsx)(w,{block:!0,children:n})})]}),e.taskType===`reading`?(0,M.jsx)(E,{gap:`lg`,children:u.map(e=>(0,M.jsx)(m.Group,{label:e.prompt,value:r[e.id]||``,onChange:t=>i(n=>({...n,[e.id]:t})),withAsterisk:!0,children:(0,M.jsx)(E,{gap:`xs`,mt:`xs`,children:e.options.map(e=>(0,M.jsx)(m,{value:e,label:e,disabled:s},e))})},e.id))}):(0,M.jsxs)(M.Fragment,{children:[e.taskType===`modifying`&&(0,M.jsx)(b,{color:`orange`,title:`Required changes`,children:(0,M.jsx)(`ol`,{children:_e(e.dataContext).map(e=>(0,M.jsx)(`li`,{children:e},e))})}),(0,M.jsx)(T,{"aria-label":[e.format,e.taskType,`editor`].join(` `),autosize:!0,minRows:14,label:[e.format,`document`].join(` `),value:a,onChange:e=>o(e.currentTarget.value),disabled:s,styles:{input:{fontFamily:`monospace`,fontSize:14}}})]}),(0,M.jsx)(C,{onClick:()=>{c(!0);let n={taskId:e.taskId,dataContext:e.dataContext,format:e.format,taskType:e.taskType,elapsedSeconds:Math.round((Date.now()-l)/1e3)};t({status:!0,answers:e.taskType===`reading`?{...n,responses:r}:{...n,document:a}})},disabled:s||!d,children:s?`Task recorded`:`Record task response`})]})}export{$ as n,de as t};