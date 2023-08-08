const fs = require("fs");
const childProcess = require("child_process");
const path = require("path");
const CWD = process.cwd();

let projectdir = path.resolve(CWD, process.argv[2])
fs.mkdirSync(path.resolve(projectdir, "tmp"), {recursive: true})
fs.mkdirSync(path.resolve(projectdir, "backup"), {recursive: true})
const cfg = JSON.parse(fs.readFileSync(path.resolve(projectdir, "deploy.json")).toString())


class GIT {
    constructor(cfg) {
        this.org = cfg.git.org
        this.repo = cfg.git.repo
        this.branch = cfg.git.branch
        this.token = cfg.git.token
        this.headers = {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${this.token}`,
            "X-GitHub-Api-Version": "2022-11-28"
        }
    }

    async getLatestTag() {
        return await fetch(`https://api.github.com/repos/${this.org}/${this.repo}/tags`, {headers: this.headers})
            .then(res => res.json())
            .then(res => {
                if (res.length === 0) error("Tags not found!");
                else return res[0].name;
            })
    }

    async read() {
        console.log(`Fetchin ${this.branch} branch of ${this.org}/${this.repo}`)
        return await fetch(`https://api.github.com/repos/${this.org}/${this.repo}/branches`, {headers: this.headers})
            .then(res => res.json())
            .then(res => res.find(item => item.name === this.branch))
            .then(async res => {
                if (res === undefined) error("Branch not found!");
                else return await this.getLatestTag();
            })
    }

    async clone(dir) {
        await exec(`git clone git@github.com:${this.org}/${this.repo}.git ${dir}`, {});
    }
}

function error(message) {
    console.log("❌ " + message || "");
    process.exit(1);
}

function ok(message) {
    console.log(`✅ ${message || ""}`)
}

async function exec(cmd) {
    console.log(`- RUN: ${cmd}`)
    return new Promise((resolve) => childProcess.exec(cmd, (err, stdout, stderr) => {
        // console.log(stdout)
        resolve();
    }));
}

async function execAll(cmds) {
    for (const cmd of cmds) await exec(cmd)

}

async function deploy() {

    const git = new GIT(cfg);

    const NEWTAG = (await git.read()).trim();
    const OLDTAG =
        fs.existsSync(path.resolve(projectdir, "deployed.txt"))
            ? fs.readFileSync(path.resolve(projectdir, "deployed.txt")).toString().trim()
            : "0";

    console.log(`OLD-TAG: ${OLDTAG}`);
    console.log(`NEW-TAG: ${NEWTAG}`);

    if (OLDTAG !== NEWTAG) {
        console.log("Changes detected, deploy project")
        const timestamp = (Math.floor(Date.now().valueOf() / 1000)).toString();
        const dir = path.resolve(projectdir, "tmp", timestamp);

        fs.mkdirSync(dir)

        console.log(`[Clone from GIT]`)
        await git.clone(dir)

        console.log(`[Copy/Link resources]`)
        for (const symlink in cfg.symlink) {
            const src = path.resolve(projectdir, symlink);
            const target = path.resolve(CWD, dir, cfg.symlink[symlink]);
            console.log(`- LINK: ${src} => ${target}`)
            fs.symlinkSync(src, target);
        }

        for (const copy in cfg.copy) {
            const src = path.resolve(projectdir, copy);
            const target = path.resolve(CWD, dir, cfg.copy[copy]);
            console.log(`- COPY: ${src} => ${target}`)
            fs.copyFileSync(src, target);
        }
        process.chdir(dir)

        console.log("[Prepare]")
        await execAll(cfg.scripts.prepare)

        console.log("[Stop service]")
        await execAll(cfg.scripts.stop)

        if (fs.existsSync(path.resolve(projectdir, cfg.target))) {
            console.log("[Create Backup]")
            fs.renameSync(path.resolve(projectdir, cfg.target), path.resolve(projectdir, "backup", timestamp + "(" + OLDTAG + ")"));
        }
        console.log("[Deploy]")
        fs.renameSync(dir, path.resolve(projectdir, cfg.target));

        console.log("[Start service]")
        await execAll(cfg.scripts.start)

        fs.writeFileSync(path.resolve(projectdir, "deployed.txt"), NEWTAG)

    } else {
        console.log("No changes detected")
    }
}

deploy();
