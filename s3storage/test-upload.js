async function run() {
  const response = await fetch("https://s3storage.tamilframework.workers.dev/api/storage/presign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "test.txt",
      contentType: "text/plain",
      isPublic: true
    })
  });
  
  const { uploadUrl, downloadUrl, key } = await response.json();
  console.log("Key:", key);
  console.log("Upload URL:", uploadUrl);
  console.log("Download URL:", downloadUrl);

  console.log("Uploading file...");
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: "Hello from Node.js TAR S3 test!"
  });

  console.log("Upload Status:", uploadResponse.status);
  if (uploadResponse.status !== 200) {
    console.log("Upload Error Body:", await uploadResponse.text());
    return;
  }

  console.log("Downloading file back...");
  const downloadResponse = await fetch(downloadUrl);
  console.log("Downloaded Content:", await downloadResponse.text());
}

run().catch(console.error);
