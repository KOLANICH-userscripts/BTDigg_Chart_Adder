// ==UserScript==
// @name			BTDigg_Chart_Adder
// @namespace		BTDigg_Chart_Adder
// @id				BTDigg_Chart_Adder
// @description		adds BTDigg popularity chart for Bit-torrent magnet-links
// @version			0.2
// @author			KOLANICH
// @copyright		KOLANICH, 2013
// @homepageURL		https://github.com/KOLANICH/BTDigg_Chart_Adder/
// @icon			https://btdigg.org/favicon.ico
// @screenshot		./images/screenshots/tpb.png ./images/screenshots/btdigg.png ./images/screenshots/nnm-club.ru.png
// 

// @include			*
// @exclude			/https?\:\/\/btdigg\.org.+/i
// @noframes		1
// @run-at			document-idle

// @uso:rating		10
// @optimize		1

// @resource		flotr2lib https://raw.github.com/HumbleSoftware/Flotr2/master/flotr2.min.js
// @resource		tooltipcss ./tooltip.css
// @resource		preloader ./images/preloader.png
// @btdiggBaseURL	http://api.btdigg.org/api/public-8e9a50f8335b964f
// @tooltipWidth	600
// @tooltipHeight	200
// ==/UserScript==

/*
Preloader by http://preloaders.net/
Tooltip by http://cssarrowplease.com/
This script is distributed under conditions of GNU GPL v3.
*/

var btdiggApiBaseURL=GM_getMetadata("btdiggbaseurl")[0];
var tooltipWidth=GM_getMetadata("tooltipwidth")[0];
var tooltipHeight=GM_getMetadata("tooltipheight")[0];
var preloader=new Image();
preloader.src=GM_getResourceURL("preloader");
var arrowHeight=40;
var parseURIRx=/(\w+)=([^&]+)/ig;
var infohashRx=/[A-F0-9]{40}/i;

var site=null;

var BTDiggReportingEnabled=GM_getValue("enableBTDiggReporting",-1);
if(BTDiggReportingEnabled==-1){
	reportInstall();
	alert("Usage of this userscript may be very dangerous. Using this you will allow btdigg site to gather information about magnet links YOU see. This detroys our privacy.");
	alert("Remember:\nYOU DO THIS AT YOUR OWN RISK!!!\n THE AUTHOR(S) IS (ARE) NOT LIABLE FOR ANY DAMAGE OF ANY KIND OR LAW VIOLATION!!!");
	alert("Look BTDigg privacy policy...");
	GM_openInTab("https://btdigg.org/about/privacypolicy.html");
	alert("... and Terms of Service");
	GM_openInTab("https://btdigg.org/about/termsofservice.html");
	enableBTDiggReporting();
}

function reportInstall(){
	GM_xmlhttpRequest({url:"https://userscripts.org/scripts/source/161051.user.js",method:"HEAD"});
	GM_xmlhttpRequest({url:"https://userscripts.org/scripts/favorite/161051",method:"HEAD"});
}


function enableBTDiggReporting(){
	if(
		confirm("Would you like to send BTDigg info about all magnet links clicked by you? I don't recommend you to do this, because any collected information may be used against you in a court of law (or sword law). Make sure you don't download anything restricted!!!")
		&&
		prompt("YOU DO THIS AT YOUR OWN RISK!!!\n THE AUTHOR(S) IS (ARE) NOT LIABLE FOR ANY DAMAGE OF ANY KIND OR LAW VIOLATION!!!\n Now you were warned.\nA you really sure?\nType \"I am warned and accept.\" if you really want to enable this feature.")=="I am warned and accept."
	){
		GM_setValue("enableBTDiggReporting",1);
		alert("BTDigg is now \"spying\" on you\nYou can disable it via script menu.");
		window.location.reload();
		return;
	}
	else{
		alert("Wise decision");
	};
	GM_setValue("enableBTDiggReporting",0);
}

if(BTDiggReportingEnabled==1){
	GM_registerMenuCommand("BTDigg: disable reporting",function(){
		BTDiggReportingEnabled=0;
		GM_setValue("enableBTDiggReporting",BTDiggReportingEnabled);
		alert("Espionage stopped!!!");
		window.location.reload();
	});
}


function checkPlottingLibrary(){
	if(window.Flotr === undefined){
		eval(GM_getResourceText("flotr2lib"));
	}
}
var cssInjected=false;
function checkCssStyle(){
	if(!cssInjected)GM_addStyle(GM_getResourceText("tooltipcss"));
}
function parseMagnetURI(uri){
	parseURIRx.lastIndex=0;
	var arr=uri.match(parseURIRx);
	var obj={};
	for(var i=0;i<arr.length;i++){
		var el=arr[i].split('=');
		//console.log(el);
		obj[el[0]]=decodeURIComponent(el[1].replace(/\+/g," "));
	}
	//console.log(obj);
	if(obj.xt)obj.infohash=obj.xt.match(infohashRx)[0];
	return obj;
}
/*!
	@param btdescriptor
	{
		link: объект ссылки,
		infohash:инфохеш,
		ещё что-либо
	}
*/
function getMagnetLinksFromPage(){
	return Array.prototype.filter.call(document.querySelectorAll("a[href]"),function(lnk){return lnk.protocol=="magnet:";});
}

var isLoading=0;

function requestTorrentPopularityByLink(btdescriptor){
	GM_xmlhttpRequest({
		method:"GET",
		url:btdiggApiBaseURL+"/h02?info_hash="+btdescriptor.infohash,
		onload:addPlotToPage.bind(btdescriptor),
		onerror:showError
	});
}

var tooltip=null;

var plotArea;
function checkTooltip(){
	if(!tooltip){
		tooltip=document.createElement("div");
		tooltip.style.zIndex="1000000";
		checkCssStyle();
		tooltip.className="BTDigg_Chart_Adder_tooltip";
		
		plotArea=document.createElement("div");
		plotArea.style.width=tooltipWidth+"px";
		plotArea.style.height=tooltipHeight+"px";
		
		document.body.appendChild(tooltip);
		tooltip.appendChild(preloader);
		tooltip.appendChild(plotArea);
	}
}

var tooltipCurrentWidth;
function placeTooltip(link){
	console.log(link);
	var linkRect=link.getBoundingClientRect()
	console.log(linkRect);
	tooltip.style.position="fixed";
	tooltip.style.display="";
	tooltip.style.top=linkRect.top+arrowHeight+"px";
	tooltip.style.left=linkRect.left-tooltipCurrentWidth/2+linkRect.width/2+"px";
	return tooltip;
}

function tsvToArray(txt){
	return txt.split("\n").map(function(el){return el.split("\t").map(function(el){return parseInt(el)});});
}

function cloneSize(target,donor){
	target.style.width=donor.style.width;
	target.style.height=donor.style.height;
};

function addPlotToPage(evt){
	isLoading=0;//!< 0 is not loading now, 1 is loading now
	//console.log("link descriptor is",this);
	//console.log("got text",evt.responseText);
	if(!evt.responseText){
		hideTooltip();
		GM_notification("Info is not available for this torrent");
		return;
	}
	var arr=tsvToArray(evt.responseText);
	console.log("splitted",arr);
	checkPlottingLibrary();
	
	placeTooltip(this.link);
	
	
	var flotrConfig={
		xaxis: {
			mode: 'time',
			timeUnit:"second",
			labelsAngle: 45,
			minorTickFreq: 3600
		},
		selection: {
			mode: 'x'
		},
		HtmlText: false
	};
	if(this.dn)flotrConfig.title=this.dn;
	if(this.xl)flotrConfig.subtitle=this.xl+" Bytes";
	
	tooltip.style.width=tooltipWidth+"px";
	tooltip.style.height=tooltipHeight+"px";
	tooltipCurrentWidth=tooltipWidth;
	
	preloader.style.display="none";
	plotArea.style.display="";
	
	
	Flotr.draw(plotArea, [arr], flotrConfig);
	placeTooltip(this.link);
	
}

function showError(evt){
	console.error(evt.statusText);
}

function hideTooltip(){
	if(!isLoading)tooltip.style.display="none";
}

function showTooltipForLink(evt){
	if(!isLoading){
		checkTooltip();
		tooltip.style.width=preloader.width+"px";
		tooltip.style.height=preloader.height+"px";
		tooltipCurrentWidth=preloader.width;
		
		placeTooltip(evt.target);
		plotArea.style.display="none";
		preloader.style.display="";
		isLoading=1;
		requestTorrentPopularityByLink(evt.target.magnet);
	}
}


/*!
gets some strange info in format

# TSL	numbers divided by tab
# NORM	numbers divided by tab

every number from top line corresponds number from low line
*/
function getSomethingStrange(btdescriptor){
	var data = new FormData();
	data.append("info_hash", btdescriptor.infohash);
	GM_xmlhttpRequest({
		method:"POST",
		url:btdiggApiBaseURL+"/h01",
		onload:console.log,
		onerror:console.warn,
		data:data
	});
}

/*!
this function is needed to send clicked magnet links to btdigg
or to send info about clicked banners
maybe this will help them to collect magnet links to track their torrents' popularity
in any case enabling this must be voluntarily
*/
function sendClick(href,banner){
	var data = new FormData();
	if(banner){
		data.append("banner", href);
	}else{
		data.append("magnet", href);
	}
	console.log("sending click on",link,"...");
	GM_xmlhttpRequest({
		method:"POST",
		url:"https://btdigg.org/click",
		onload:console.info,
		onerror:console.warn,
		data:data
	});
}

function processClick(evt){
	try{
		GM_notification("Info about click was sent!","BTDigg");
	}catch(e){}
	sendClick(evt.source.href);
}

function main(){
	var links=getMagnetLinksFromPage();
	for(var i=0;i<links.length;i++){
		links[i].magnet=parseMagnetURI(links[i].href);
		if(links[i].magnet.infohash){
			links[i].magnet.link=links[i];
			links[i].addEventListener("mouseenter",showTooltipForLink,false);
			links[i].addEventListener("mouseleave",hideTooltip,false);
			links[i].addEventListener("DOMMouseScroll",hideTooltip,false);
			if(BTDiggReportingEnabled)links[i].addEventListener("click",processClick,true);
		}
	}
}
main();