const sizeUnits = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB' ];

export function noop() {
}

export function invokeAsync(f, ...params) {
	setTimeout(
		() => f(...params), 
		0
	);
}

export function isNumber(value) {
	return typeof value === 'number' || value instanceof Number; 
}

export function isFunction(value) {
	return typeof value === 'function';
}

export function isUndefined(value) {
	return typeof value === 'undefined';
}

export function isDefined(value) {
	return !isUndefined(value);
}

export function toCammelCase(str) {
	return str.replace(/-\w/g, match => match[1].toUpperCase());
}

export function toDashedCase(str) {
	return str.replace(/[A-Z]+/g, match => `-${match.toLowerCase()}`);
}

export function formatSize(num) {
	const peta = 1024 ** 5;

	let i = 0; 
	if (!isNumber(num)) {
		if (num.peta > 0) {
			i = 5;
			num = num.peta + num.n / peta;			
		} else {
			num = num.n;
		}
	} 

	while (num / 1024 > 1) {
		num /= 1024;
		++i;
	}
	
	if (i > 0) {
		num = num.toFixed(num < 10 ? 1 : 0);
	}

	return `${num}${sizeUnits[i]}`;
}

export function randomName(len = 8) {
	return Math.random().toString(36).substring(7);
}

export function parseQueryString(str) {
	return decodeURIComponent(str)
		.replace(/(^\?)/,'')
		.split("&")
		.filter(part => part)
		.reduce( (result, part) => {
			let [name, value] = part.split('=');
			result[toCammelCase(name)] = value || true;
			return result;
		}, {});
}

export function stringifyQueryString(query) {
	return Object.keys(query)
		.reduce((list, key) => {
			if (!isUndefined(query[key])) {
				let name = encodeURIComponent(toDashedCase(key));
				let value = encodeURIComponent(query[key]);
				list.push((`${name}=${value}`))
			}

			return list;
		}, [])
		.join('&');
}

export function realizeUri(uri, params) {
	return uri
		.split('/')
		.map(part => part[0] === ':' ? params[part.substr(1)] : part)
		.join('/');
}

export function createCompareFunc(accessor, descending = false) {
	return function (obj1, obj2) {
		let value1 = accessor(obj1);
		let value2 = accessor(obj2);
		
		return (descending ? -1 : 1) * 
			(value1 < value2 ? -1 : (value1 > value2 ? 1 : 0));
	}
}

export function throttle(func, grace, owner) {
	let handle = null;
	return function(...args) {
		clearTimeout(handle);
		handle = setTimeout(() => func.apply(owner || this, args), grace);
	}
}