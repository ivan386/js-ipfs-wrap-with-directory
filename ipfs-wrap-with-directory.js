function pb_varint(number, buffer)
{
	while(number > 127)
	{
		buffer.push(128 | (number & 127));
		number >>= 7;
	}
	buffer.push(number & 127);
	return buffer
}

function push_data(data, buffer)
{
	if (typeof(data) == "string")
		buffer.push(...data.split('').map(s=>s.charCodeAt(0)));
	else if (typeof(data) == "object")
		buffer.push(...data);
	else
		pb_varint(data, buffer);
		
	return buffer;
}

function pack_data(id, data, buffer)
{
	push_data(id, buffer);
	pb_varint(data.length, buffer);
	push_data(data, buffer);
	return buffer;
}

function convert_string(string)
{
	if (/^[\0-\255]*$/.test(string))
		return string;
	
	return unescape(encodeURIComponent(string));
}

function pack_file(buffer, cid, name, size)
{
	var data = [];
	if (cid)
		pack_data(0x0A, cid, data);
	if (name)
		pack_data(0x12, convert_string(name), data);
	if (size)
	{
		data.push(0x18);
		pb_varint(size, data);
	}
	
	return pack_data(0x12, data, buffer);
}

function pack_dir(buffer)
{
	return push_data("\x0A\x02\x08\x01", buffer);
}

function reencode(value, bto, bfrom, buf)
{
	for (var i = 0; i < buf.length; i++)
	{
		value = value + (buf[i] * bfrom);
		buf[i] = (value % bto) | 0;
		value = (value / bto) | 0;
	}
	
	while(value > 0)
	{
		buf.push((value % bto) | 0);
		value = (value / bto) | 0;
	}
	
	return buf
}

function base58_decode(b58, buffer)
{
	var alph = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
	var index = 0
	for (;alph.indexOf(b58[index]) == 0; index++)
		buffer.push(0);
	
	var buf = [];
	
	for (;index < b58.length; index++)
		reencode(alph.indexOf(b58[index]), 256, 58, buf);
	
	buffer.push(...buf.reverse())
	
	return buffer
}

function to_binary_cid(cid, buffer)
{
	if (cid.indexOf("/ipfs/") == 0)
	{
		cid = cid.substr(6);
		if (cid.indexOf("/") == cid.length)
			cid = cid.substr(0, cid.length - 1);
	}
	
	if (cid.indexOf("z") == 0)
		return base58_decode(cid.substr(1), buffer);
	else if(cid.indexOf("Qm") == 0)
		return base58_decode(cid, buffer);
	else if(cid.indexOf("u") == 0 || cid.indexOf("U") == 0 )
		return from_base64url_mb(cid, buffer);
	
	throw new Error('Wrong cid encoding');
}

function pack_files(files, packed)
{
	for (var file in files)
		if ( typeof(files[file]) == "object" )
			packed = pack_file(packed, pack_data("\x01\x70\x00", pack_files(files[file], []), []), file);
		else
			packed = pack_file(packed, to_binary_cid(files[file], []), file);
	
	console.log(packed.length)
	return pack_dir(packed);
}

function from_base64url_mb(data, buffer)
{
	if(data.indexOf("u") == 0 || data.indexOf("U") == 0 )
		return push_data(atob(data.substr(1).replace(/-/g,"+").replace(/_/g,"/")), buffer)
	
	throw new Error('Wrong multibase encoding');
}

function to_base64url_mb(buffer)
{
	return "u" + btoa(
			String.fromCharCode(...buffer)
		).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}

function wrap_files_with_directory(files)
{
	var packed = [];
	
	return "/ipfs/"+to_base64url_mb(
		pack_data("\x01\x70\x00",
			pack_files(files, packed)
		,	[]
		)
	) + "/"
}

function to_raw_cid(data, buffer)
{
	return to_base64url_mb(pack_data("\x01\x55\x00", data, []));
}

function wrap_with_directory(cid, file_name)
{
	return "/ipfs/u"+to_base64url_mb(
		pack_data("\x01\x70\x00",
			pack_dir(
				pack_file(
					[]
					, to_binary_cid(cid, [])
					, file_name
				)
			)
		,	[]
		)
	) + "/" + file_name;
}