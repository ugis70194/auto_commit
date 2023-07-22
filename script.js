const TOKEN = "";
const OWNER = "ugis70194";
const REPOSITORY = "test";
const DERECTORY_PATH = "contents";
const BASE_URL = `https://api.github.com/repos/${OWNER}/${REPOSITORY}`;
const TARGET_DIRECTORY = "contents";

const HEADERS = {
  "Accept": "application/vnd.github+json",
  "Authorization": `Bearer ${TOKEN}`,
};

const getRepositoryReference = async () => {
  const URL = `${BASE_URL}/git/refs/heads/main`;
  const res = await fetch(URL, {method:"GET", headers:HEADERS});
  return await res.json();
}

const getParentCommit = async (commitURL) => {
  const res = await fetch(commitURL, {method:"GET", headers:HEADERS});
  return await res.json();
}

const createBlobSHAwithFilePath = async(filePath, content, encoding) => {
  const URL = `${BASE_URL}/git/blobs`;
  const requestBody = {
    "content": content,
    "encoding": encoding,
  }
  const res = await fetch(URL, {method:"POST", headers:HEADERS, body:JSON.stringify(requestBody)});
  const data = await res.json();
  return new Object({
    filePath: filePath,
    sha: data["sha"],
  });
}

const createCommitTree = async(baseTreeSHA, blobSHAwithFilePaths) => {
  const URL = `${BASE_URL}/git/trees`;
  const tree = blobSHAwithFilePaths.map((blobSHAwithFilePath) => 
    new Object(
    {
      "path": blobSHAwithFilePath.filePath,
      "mode": "100644",
      "type": "blob",
      "sha": blobSHAwithFilePath.sha, 
    })
  );
  const requestBody = {
    "base_tree": baseTreeSHA,
    "tree": tree,
  }
  const res = await fetch(URL, {method:"POST", headers:HEADERS, body:JSON.stringify(requestBody)});
  return await res.json();
}

const createCommit = async(commitTreeSHA, parentCommitSHA) => {
  const URL = `${BASE_URL}/git/commits`;
  const requestBody = {
    "message": `create ${detail.title}`,
    "parents": [
      parentCommitSHA
    ],
    "tree": commitTreeSHA
  }
  const res = await fetch(URL, {method:"POST", headers:HEADERS, body:JSON.stringify(requestBody)});
  return await res.json();
}

const push = async(commitSHA) => {
  const URL = `${BASE_URL}/git/refs/heads/main`;
  const requestBody = {
    "sha": commitSHA,
    "force": false
  }
  const res = await fetch(URL, {method:"PATCH", headers:HEADERS, body:JSON.stringify(requestBody)});
  return res["statusText"];
}

const getDirectoryContent = async(path) => {
  const URL = `${BASE_URL}/contents/${path}`;
  const res = await fetch(URL, {method:"GET", headers:HEADERS});
  const data = await res.json();
  return await Promise.all(data.map(async content => {
    if(content["type"] === "file"){
      return new Object({path: content["path"], sha: content["sha"]})
    }else if(content["type"] === "dir"){
      return await getDirectoryContent(content["path"]);
    }
  }))
}

const deleteContent = async(path, contentSHA) => {
  const URL = `${BASE_URL}/contents/${path}`;
  const requestBody = {
    "message": `delete ${path}`,
    "sha": contentSHA,
  }
  const res = await fetch(URL, {method:"DELETE", headers:HEADERS, body:JSON.stringify(requestBody)});
  const data = await res.json();
  return data["content"];
}

let samplesCount = 0;

const detail = {
  title: ""
};

const work = {
  detail: '',
  cover: new ArrayBuffer(),
  samples: [],
}

const titleInputForm = document.getElementById('input-title');
const coverInputForm = document.getElementById('input-cover');
const coverImages = document.getElementById('cover-images');
const sampleInputForm = document.getElementById('input-sample');
const sampleImages = document.getElementById('sample-images');
const reset = document.getElementById('reset');
const deleteFileButton = document.getElementById('delete-file');
const generate = document.getElementById('generate');

const generateContents = async() => {
  detail.title = titleInputForm.value;
  work.detail = JSON.stringify(detail);

  const RepositoryRef = await getRepositoryReference();
  const parentCommit = await getParentCommit(RepositoryRef["object"]["url"]);
  const blobSHAwithFilePaths = await Promise.all([
    await createBlobSHAwithFilePath(`${TARGET_DIRECTORY}/${detail.title}/detail.json`, work.detail, "utf-8"),
    await createBlobSHAwithFilePath(`${TARGET_DIRECTORY}/${detail.title}/cover.jpg`, work.cover, "base64"),
    await Promise.all(work.samples.map(async(blob, index) => {
      return await createBlobSHAwithFilePath(`${TARGET_DIRECTORY}/${detail.title}/sample/page${index+1}.jpg`, blob, "base64")
    }))
  ]);
  const commitTree = await createCommitTree(parentCommit["tree"]["sha"], blobSHAwithFilePaths.flat());
  const commit = await createCommit(commitTree["sha"], parentCommit["sha"]);
  const statusText = await push(commit["sha"]);
  console.log(statusText);
};

generate.addEventListener("click", generateContents, false);

reset.addEventListener("click", () => {
  sampleInputForm.value = null;
  sampleImages.innerHTML = '';
  samplesCount = 0;
  samples = [];
}, false);

deleteFileButton.addEventListener("click", async() => {
  detail.title = titleInputForm.value;
  const contents = await getDirectoryContent(`${DERECTORY_PATH}/${detail.title}`);
  for(const content of contents.flat()){
    const res = await deleteContent(content["path"], content["sha"]);
    if(!res){
      console.log(`deleted ${detail.title}`);
    }
  }
})

coverInputForm.addEventListener("change", event => {
  const choosedFiles = event.target.files;

  coverImages.appendChild(document.createElement("figure"));
  let img = coverImages.appendChild(document.createElement("img"));
  
  let fileReader = new FileReader();
  fileReader.readAsDataURL(choosedFiles[0]);
  fileReader.onload = () => {
    img.src = fileReader.result;
    work.cover = fileReader.result.split(',')[1];
  }
})

sampleInputForm.addEventListener("change", event => {
  const choosedFiles = event.target.files;
  const choosedCount = choosedFiles.length;

  for(let i = 0; i < choosedCount; i++){
    sampleImages.appendChild(document.createElement("figure"));
    let img = sampleImages.appendChild(document.createElement("img"));
    let caption = sampleImages.appendChild(document.createElement("figcaption"));
    
    let fileReader = new FileReader();
    fileReader.readAsDataURL(choosedFiles[i]);
    fileReader.onload = () => {
      img.src = fileReader.result;
      work.samples.push(fileReader.result.split(',')[1]);
      caption.append(`page ${++samplesCount}`);
    }
  }
  
}, false);