const mfnClss = require('@design-automation/mobius-sim-funcs').Funcs;
const ifnClss = require('@design-automation/mobius-inline-funcs').InlineClass;
const mfn = new mfnClss();
const ifn = new ifnClss(true);

__main_func(mfn, ifn, 5, 0.2, 0.4, 140, 'round').then(result => console.log(getModelString(result.model)))

function getModelString(model) {
    let model_data = model.exportGI(null);
    model_data = model_data.replace(/\\/g, "\\\\\\"); // TODO temporary fix
    return model_data;
}

async function __main_func(mfn, ifn, REST_LENGTH, STIFFNESS, UP_FORCE, NUM_ITERATIONS, NET_TYPE) {
    __model__ = null;


    async function exec_Form_Finding_Solver($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_) {

        async function exec_Form_Finding_Solver_node_lxmqng2eusm($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_) {
            if (mfn._getModel().debug) { printFunc($p.console, 'Executing: Make square net', '__null__') }


            let size_ = 15;

            let g_ = mfn.pattern.Grid(JSON.parse(JSON.stringify(ifn.constants.XY)), 123, size_, 'quads');

            let pgons_ = mfn.make.Polygon(g_);

            let posis_ = mfn.query.Get('ps', null);

            for (let i_ of ifn.list.range(ifn.common.len(posis_))) {

                mfn.attrib.Set(posis_[pythonList(i_, posis_.length)], `i`, i_);
            }

            let fixed_ = [0, size_ - 1, size_ * (size_ - 1), (size_ * size_) - 1];

            for (let i_ of fixed_) {

                mfn.attrib.Set(posis_[pythonList(i_, posis_.length)], `fixed`, true);
            }

            let coll_ = mfn.collection.Create(mfn.query.Get('pg', null), "square");
        }


        async function exec_Form_Finding_Solver_node_ew77mtf8tor($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_) {
            if (mfn._getModel().debug) { printFunc($p.console, 'Executing: Make round net', '__null__') }


            let posis1_ = mfn.pattern.Arc(JSON.parse(JSON.stringify(ifn.constants.XY)), 20, 7,
                null);

            let cen_ = mfn.make.Position([0, 0, 0]);

            let cables_ = [];

            for (let posi_ of posis1_) {

                let cable_ = mfn.make.Polyline([cen_, posi_], 'open');

                mfn.list.Add(cables_, cable_, 'to_end');
            }

            let posis2_ = mfn.pattern.Arc(JSON.parse(JSON.stringify(ifn.constants.XY)), 123, 7, null);

            let pl1_ = mfn.make.Polyline(posis1_, 'close');

            let pl2_ = mfn.make.Polyline(posis2_, 'close');

            mfn.attrib.Set(posis2_, `fixed`, true);

            let d_ = mfn.edit.Divide([pl1_, pl2_], 8, 'by_number');

            let skin_ = mfn.make.Loft([pl2_, pl1_], 8, 'open_quads');

            mfn.edit.Delete([pl1_, pl2_], 'delete_selected');

            let coll_ = mfn.collection.Create([skin_, cables_], "round");
        }


        async function exec_Form_Finding_Solver_node_pyfyrdzpcyk($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_) {
            if (mfn._getModel().debug) {
                printFunc($p.console, 'Executing: Switch', '__null__')
            }


            let coll_ = mfn.collection.Get(NET_TYPE_);

            mfn.edit.Delete(coll_, 'keep_selected');
        }


        async function exec_Form_Finding_Solver_node_b69pxl4mk4v($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_) {
            if (mfn._getModel().debug) { printFunc($p.console, 'Executing: Run solver', '__null__') }


            let pgons_ = mfn.query.Get('pg', null);

            let posi_xyz_ = [];

            let posis_ = mfn.query.Get('ps', null);

            let fixed_ = [];

            for (let i_ of ifn.list.range(ifn.common.len(posis_))) {

                if (mfn.attrib.Get(posis_[pythonList(i_, posis_.length)], 'fixed')) {

                    mfn.list.Add(fixed_, i_, 'to_end');
                }

                if (posi_xyz_[pythonList(i_, posi_xyz_.length)] == null) {

                    posi_xyz_[pythonList(i_, posi_xyz_.length)] = mfn.attrib.Get(posis_[pythonList(i_, posis_.length)], 'xyz');

                    mfn.attrib.Set(posis_[pythonList(i_, posis_.length)], `i`, i_);
                }
            }

            let posi_n_ = [];

            for (let pi_ of ifn.list.range(ifn.common.len(posis_))) {

                posi_n_[pythonList(pi_, posi_n_.length)] = ifn.set.setDif(mfn.attrib.Get(mfn.query.Get('ps', mfn.query.Get('_e', mfn.query.Get('_v', posis_[pythonList(pi_, posis_.length)]))), 'i'), [pi_]);
            }

            for (let iter_ of ifn.list.range(NUM_ITERATIONS_)) {

                let posi_xyz_tmp_ = [];

                for (let pi_ of ifn.list.range(ifn.common.len(posis_))) {

                    if (ifn.list.listHas(fixed_, pi_)) {

                        posi_xyz_tmp_[pythonList(pi_, posi_xyz_tmp_.length)] = posi_xyz_[pythonList(pi_, posi_xyz_.length)];

                        continue;
                    }

                    let vec_sum_ = [0, 0, UP_FORCE_];

                    for (let pni_ of posi_n_[pythonList(pi_, posi_n_.length)]) {

                        let edge_vec_ = ifn.vec.vecFromTo(posi_xyz_[pythonList(pi_, posi_xyz_.length)], posi_xyz_[pythonList(pni_, posi_xyz_.length)]);

                        let deform_ = ifn.vec.vecLen(edge_vec_) - REST_LENGTH_;

                        let force_ = deform_ * STIFFNESS_;

                        edge_vec_ = ifn.vec.vecSetLen(edge_vec_, force_);

                        vec_sum_ = ifn.vec.vecAdd(vec_sum_, edge_vec_);
                    }

                    posi_xyz_tmp_[pythonList(pi_, posi_xyz_tmp_.length)] = ifn.vec.vecAdd(posi_xyz_[pythonList(pi_, posi_xyz_.length)], vec_sum_);
                }

                posi_xyz_ = posi_xyz_tmp_;
            }

            for (let p_ of mfn.query.Get('ps', null)) {

                mfn.attrib.Set(p_, `xyz`, posi_xyz_[pythonList(mfn.attrib.Get(p_, 'i'), posi_xyz_.length)]);
            }
        }


        async function exec_Form_Finding_Solver_node_xb0uguhzzym($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_) {
            if (mfn._getModel().debug) { printFunc($p.console, 'Executing: Color', '__null__') }

            let pgons_ = mfn.query.Get('pg', null);

            let edges_ = mfn.query.Get('_e', null);

            let lengths_ = mfn.calc.Length(mfn.query.Get('_e', null));

            mfn.attrib.Set(edges_, "length", lengths_, 'many_values');

            mfn.attrib.Push(edges_, "length", 'pg', 'average');

            mfn.visualize.Gradient(pgons_, "length", null, 'Oranges');
        }


        async function exec_Form_Finding_Solver_node_e85jl2ckclo($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_) {
            if (mfn._getModel().debug) { printFunc($p.console, 'Executing: End', '__null__') }


            return null;
        }

        var merged;
        let ssid_exec_Form_Finding_Solver_node_pud3fp3mcd = mfn._getModel().getActiveSnapshot();

        let ssid_exec_Form_Finding_Solver_node_lxmqng2eusm = mfn._getModel().nextSnapshot([ssid_exec_Form_Finding_Solver_node_pud3fp3mcd]);

        await exec_Form_Finding_Solver_node_lxmqng2eusm($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_);

        let ssid_exec_Form_Finding_Solver_node_ew77mtf8tor = mfn._getModel().nextSnapshot([ssid_exec_Form_Finding_Solver_node_pud3fp3mcd]);

        await exec_Form_Finding_Solver_node_ew77mtf8tor($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_);

        let ssid_exec_Form_Finding_Solver_node_pyfyrdzpcyk = mfn._getModel().nextSnapshot([ssid_exec_Form_Finding_Solver_node_lxmqng2eusm, ssid_exec_Form_Finding_Solver_node_ew77mtf8tor]);

        await exec_Form_Finding_Solver_node_pyfyrdzpcyk($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_);

        let ssid_exec_Form_Finding_Solver_node_b69pxl4mk4v = ssid_exec_Form_Finding_Solver_node_pyfyrdzpcyk;

        await exec_Form_Finding_Solver_node_b69pxl4mk4v($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_);

        let ssid_exec_Form_Finding_Solver_node_xb0uguhzzym = ssid_exec_Form_Finding_Solver_node_b69pxl4mk4v;

        await exec_Form_Finding_Solver_node_xb0uguhzzym($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_);

        let ssid_exec_Form_Finding_Solver_node_e85jl2ckclo = mfn._getModel().nextSnapshot([ssid_exec_Form_Finding_Solver_node_xb0uguhzzym]);

        return await exec_Form_Finding_Solver_node_e85jl2ckclo($p, REST_LENGTH_, STIFFNESS_, UP_FORCE_, NUM_ITERATIONS_, NET_TYPE_);
    }


    function pythonList(x, l) {
        if (x < 0) {
            return x + l;
        }
        return x;
    }

    function printFunc(_console, name, value) {
        let val;
        let padding_style = 'padding: 2px 0px 2px 10px;';
        if (!value) {
            val = value;
        } else if (value === '__null__') {
            _console.push('<p style="' + padding_style + '"><b><i>_ ' + name + '</i></b></p>');
            return value;
        } else if (typeof value === 'number' || value === undefined) {
            val = value;
        } else if (typeof value === 'string') {
            val = '"' + value.replace(/\n/g, '<br>') + '"';
        } else if (value.constructor === [].constructor) {
            let __list_check__ = false;
            let __value_strings__ = [];
            for (const __item__ of value) {
                if (!__item__) {
                    __value_strings__.push('' + __item__);
                    continue;
                }
                if (__item__.constructor === [].constructor || __item__.constructor ===
                    {}.constructor) {
                    __list_check__ = true;
                }
                __value_strings__.push(JSON.stringify(__item__).replace(/,/g, ', '));
            }
            if (__list_check__) {
                padding_style = 'padding: 2px 0px 0px 10px;';
                val = '[<p style="padding: 0px 0px 2px 40px;">' +
                    __value_strings__.join(',</p><p style="padding: 0px 0px 2px 40px;">') +
                    '</p><p style="padding: 0px 0px 2px 30px;">]</p>';
            } else {
                val = '[' + __value_strings__.join(', ') + ']';
            }
        } else if (value.constructor === {}.constructor) {
            let __list_check__ = false;
            let __value_strings__ = [];
            for (const __item__ in value) {
                const __value__ = value[__item__];
                if (!__value__) {
                    __value_strings__.push('\<b>"' + __item__ + '\"</b>' + ': ' + __value__);
                    continue;
                }
                if (__value__.constructor === [].constructor || __value__.constructor === {}.constructor) {
                    __list_check__ = true;
                }
                __value_strings__.push('\<b>"' + __item__ + '\"</b>' + ': ' + JSON.stringify(__value__).replace(/,/g, ', '));
            }
            if (__list_check__) {
                padding_style = 'padding: 2px 0px 0px 10px;';
                val = '{<p style="padding: 0px 0px 2px 40px;">' +
                    __value_strings__.join(',</p><p style="padding: 0px 0px 2px 40px;">') +
                    '</p><p style="padding: 0px 0px 2px 30px;">}</p>';
            } else {
                val = '{' + __value_strings__.join(', ') + '}';
            }
        } else {
            val = value;
        }
        _console.push('<p style="' + padding_style + '"><b><i>_ ' + name + '</i></b>  = '
            + val + '</p>');
        return val;
    }


    const $p = {};
    if (__model__) {
        mfn.io._importGI(__model__);
    }
    mfn._getModel().debug = true;
    $p["console"] = [];
    $p["modules"] = mfn;
    $p["curr_ss"] = {};
    const result = await exec_Form_Finding_Solver($p, REST_LENGTH, STIFFNESS, UP_FORCE,
        NUM_ITERATIONS, NET_TYPE);
    if (result === mfn._getModel()) {
        return {
            "model": mfn._getModel(), "result": null
        };
    }
    return { "model": mfn._getModel(), "result": result };

}
