import { FaucetDbDriver } from '../../db/FaucetDatabase';
import { FaucetModuleDB } from '../../db/FaucetModuleDB';
import { SQL } from '../../db/SQL';
import { IIPInfo } from './IPInfoResolver';

export class IPInfoDB extends FaucetModuleDB {
  protected override latestSchemaVersion = 1;
  
  protected override async upgradeSchema(version: number): Promise<number> {
    switch(version) {
      case 0:
        version = 1;
        await this.db.exec(SQL.driverSql({
          [FaucetDbDriver.SQLITE]: `
            CREATE TABLE "IPInfoCache" (
              "IP" TEXT NOT NULL UNIQUE,
              "Json" TEXT NOT NULL,
              "Timeout" INTEGER NOT NULL,
              PRIMARY KEY("IP")
            );`,
          [FaucetDbDriver.MYSQL]: `
            CREATE TABLE IPInfoCache (
              IP VARCHAR(40) NOT NULL,
              Json TEXT NOT NULL,
              Timeout INT(11) NOT NULL,
              PRIMARY KEY(IP)
            );`,
        }));
        await this.db.exec(SQL.driverSql({
          [FaucetDbDriver.SQLITE]: `CREATE INDEX "IPInfoCacheTimeIdx" ON "IPInfoCache" ("Timeout"	ASC);`,
          [FaucetDbDriver.MYSQL]: `ALTER TABLE IPInfoCache ADD INDEX IPInfoCacheTimeIdx (Timeout);`,
        }));
    }
    return version;
  }

  public override async cleanStore(): Promise<void> {
    await this.db.run("DELETE FROM IPInfoCache WHERE Timeout < ?", [this.now()]);
  }

  public async getIPInfo(ip: string): Promise<IIPInfo> {
    let row = await this.db.get(
      "SELECT Json FROM IPInfoCache WHERE IP = ? AND Timeout > ?", 
      [ip.toLowerCase(), this.now()]
    ) as {Json: string};
    if(!row)
      return null;
    
    return JSON.parse(row.Json);
  }

  public async setIPInfo(ip: string, info: IIPInfo, duration?: number): Promise<void> {
    let now = this.now();
    let row = await this.db.get("SELECT Timeout FROM IPInfoCache WHERE IP = ?", [ip.toLowerCase()]);
    
    let timeout = now + (typeof duration === "number" ? duration : 86400);
    let infoJson = JSON.stringify(info);

    if(row) {
      await this.db.run("UPDATE IPInfoCache SET Json = ?, Timeout = ? WHERE IP = ?", [infoJson, timeout, ip.toLowerCase()]);
    }
    else {
      await this.db.run("INSERT INTO IPInfoCache (IP, Json, Timeout) VALUES (?, ?, ?)", [ip.toLowerCase(), infoJson, timeout]);
    }
  }

}