# Deploy from github

1. Create a project directory
2. Create a configuration file into the project dir `deploy.json`

```json
{
	"git": {
		"token": "github token",
		"org": "organisation name",
		"repo": "repository name",
		"branch": "main"
	},
	"symlink": {
		"source from project root": "target"
	},
	"copy": {
		 "source from project root": "target"
	},
	"target": "deployment location",
	"scripts": {
		"stop": [
			"echo stop service"
		],
		"start": [
			"echo start service"
		],
		"prepare": [
			"npm install",
			"echo prepare project"
		]
	}
}
```

3. Call the script
```
node deploy <project folder name>
```