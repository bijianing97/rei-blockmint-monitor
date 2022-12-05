import sequelize from "../db/db";

export const migrate = async () => {
  sequelize.query(
    "create index idx_missrecord_timestamp on missrecord(timestamp)"
  );
};

(async () => {
  await migrate();
})();
